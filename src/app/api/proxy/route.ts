import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

const TARGET_BASE = 'https://n186t36xx-.space-z.ai';

// In-memory cache for HTML pages
let cachedHtml: string | null = null;

// Asset cache (fonts, css, js, images)
const assetCache = new Map<string, { data: ArrayBuffer | string; contentType: string; timestamp: number }>();
const ASSET_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function proxyFetch(url: string, extraHeaders?: Record<string, string>): Promise<Response | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: '*/*',
        ...extraHeaders,
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    return response;
  } catch {
    return null;
  }
}

function modifyHtml(html: string): string {
  let modified = html;

  // Rewrite /_next/ paths in href, src, srcset to go through our proxy
  modified = modified.replace(/(href|src|srcset)="\/_next\//g, `$1="/api/proxy?path=/_next/`);

  // Rewrite other relative paths (like /torneos, /noticias, etc.)
  modified = modified.replace(/(href|src)="\/(?!\/|api\/proxy|_next|http)([^"]*)"/g, (match, attr, path) => {
    return `${attr}="/api/proxy?path=/${path}"`;
  });

  // Intercept navigation and fix URL errors
  const interceptorScript = `
<script>
(function() {
  // Intercept all link clicks to route through proxy
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a');
    if (link && link.href) {
      var href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) return;
      e.preventDefault();
      var targetHref = link.href;
      if (targetHref.startsWith('${TARGET_BASE}')) {
        var path = targetHref.replace('${TARGET_BASE}', '');
        window.location.href = '/api/proxy?path=' + encodeURIComponent(path);
      } else if (targetHref.startsWith('/')) {
        window.location.href = '/api/proxy?path=' + encodeURIComponent(targetHref);
      } else if (targetHref.startsWith(window.location.origin)) {
        var p = targetHref.replace(window.location.origin, '');
        if (p.startsWith('/api/proxy?path=')) {
          window.location.href = p;
        } else {
          window.location.href = '/api/proxy?path=' + encodeURIComponent(p);
        }
      } else {
        window.open(targetHref, '_blank', 'noopener,noreferrer');
      }
    }
  });

  // Patch URL constructor to handle relative URLs
  var OrigURL = URL;
  window.URL = function(url, base) {
    try {
      if (base) return new OrigURL(url, base);
      if (url && typeof url === 'string' && !url.startsWith('http') && !url.startsWith('data:') && !url.startsWith('blob:')) {
        return new OrigURL(url, '${TARGET_BASE}/');
      }
      return new OrigURL(url);
    } catch(e) {
      try { return new OrigURL('${TARGET_BASE}/'); } catch(e2) { return null; }
    }
  };
  window.URL.prototype = OrigURL.prototype;
  window.URL.createObjectURL = OrigURL.createObjectURL.bind(OrigURL);
  window.URL.revokeObjectURL = OrigURL.revokeObjectURL.bind(OrigURL);

  // Intercept fetch calls to rewrite URLs
  var origFetch = window.fetch;
  window.fetch = function(input, init) {
    if (typeof input === 'string' && input.startsWith('/')) {
      input = '/api/proxy?path=' + encodeURIComponent(input);
    }
    return origFetch.call(this, input, init);
  };
})();
</script>
`;

  if (modified.includes('</body>')) {
    modified = modified.replace('</body>', interceptorScript + '</body>');
  } else {
    modified += interceptorScript;
  }

  return modified;
}

function modifyCss(css: string, cssPath: string): string {
  // Rewrite relative font URLs in CSS: ../media/xxx.woff2 -> /api/proxy?path=/_next/static/media/xxx.woff2
  // Determine the base directory of the CSS file
  const cssDir = cssPath.substring(0, cssPath.lastIndexOf('/'));

  // Rewrite url(../media/...) patterns
  let modified = css.replace(/url\(\.\.\/([^)]+)\)/g, (match, relPath) => {
    // Resolve relative path against CSS directory
    const resolved = new URL(relPath, `${TARGET_BASE}${cssDir}/`).pathname;
    return `url(/api/proxy?path=${encodeURIComponent(resolved)})`;
  });

  // Rewrite url(./...) patterns
  modified = modified.replace(/url\(\.\/([^)]+)\)/g, (match, relPath) => {
    const resolved = new URL(relPath, `${TARGET_BASE}${cssDir}/`).pathname;
    return `url(/api/proxy?path=${encodeURIComponent(resolved)})`;
  });

  // Rewrite any remaining absolute /_next/ URLs
  modified = modified.replace(/url\(\/_next\/([^)]+)\)/g, (match, path) => {
    return `url(/api/proxy?path=${encodeURIComponent('/_next/' + path)})`;
  });

  return modified;
}

function getContentType(url: string, responseHeaders: Headers): string {
  const ct = responseHeaders.get('content-type');
  if (ct) return ct.split(';')[0].trim();

  if (url.endsWith('.css')) return 'text/css';
  if (url.endsWith('.js')) return 'application/javascript';
  if (url.endsWith('.woff2')) return 'font/woff2';
  if (url.endsWith('.woff')) return 'font/woff';
  if (url.endsWith('.ttf')) return 'font/ttf';
  if (url.endsWith('.svg')) return 'image/svg+xml';
  if (url.endsWith('.png')) return 'image/png';
  if (url.endsWith('.jpg') || url.endsWith('.jpeg')) return 'image/jpeg';
  if (url.endsWith('.webp')) return 'image/webp';
  if (url.endsWith('.ico')) return 'image/x-icon';
  if (url.endsWith('.json')) return 'application/json';
  if (url.endsWith('.map')) return 'application/json';
  return 'application/octet-stream';
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const proxyPath = searchParams.get('path') || '/';
  const targetUrl = `${TARGET_BASE}${proxyPath.startsWith('/') ? proxyPath : '/' + proxyPath}`;

  // Check if this is a static asset request
  const isStaticAsset = proxyPath.startsWith('/_next/') ||
    /\.(css|js|woff2?|ttf|svg|png|jpe?g|webp|ico|json|map)(\?|$)/.test(proxyPath);

  if (isStaticAsset) {
    // Check asset cache first
    const cached = assetCache.get(proxyPath);
    if (cached && Date.now() - cached.timestamp < ASSET_CACHE_TTL) {
      const data = typeof cached.data === 'string' ? cached.data : cached.data;
      return new NextResponse(data, {
        status: 200,
        headers: {
          'Content-Type': cached.contentType,
          'Cache-Control': 'public, max-age=86400, immutable',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Fetch the asset
    const response = await proxyFetch(targetUrl);
    if (response && (response.ok || response.status === 304)) {
      const contentType = getContentType(targetUrl, response.headers);

      // For CSS files, rewrite URLs to go through proxy
      if (contentType.includes('text/css')) {
        const cssText = await response.text();
        const modifiedCss = modifyCss(cssText, proxyPath);

        assetCache.set(proxyPath, { data: modifiedCss, contentType, timestamp: Date.now() });

        return new NextResponse(modifiedCss, {
          status: 200,
          headers: {
            'Content-Type': 'text/css; charset=utf-8',
            'Cache-Control': 'public, max-age=86400, immutable',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      const data = await response.arrayBuffer();
      assetCache.set(proxyPath, { data, contentType, timestamp: Date.now() });

      // Keep cache size manageable
      if (assetCache.size > 500) {
        const oldest = [...assetCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
        for (let i = 0; i < 100; i++) {
          assetCache.delete(oldest[i][0]);
        }
      }

      return new NextResponse(data, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400, immutable',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new NextResponse('Not found', { status: 404 });
  }

  // HTML page request
  let html: string | null = null;

  // Method 1: Direct fetch
  const response = await proxyFetch(targetUrl, {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  });
  if (response && (response.ok || response.status === 500)) {
    const text = await response.text();
    if (text && text.length > 50 && text.includes('<')) html = text;
  }

  // Update in-memory cache
  if (html) {
    cachedHtml = html;
  }

  // Method 2: In-memory cache
  if (!html && cachedHtml) {
    html = cachedHtml;
  }

  // Method 3: Local file cache
  if (!html) {
    try {
      const filePath = join(process.cwd(), 'cache', 'index.html');
      html = await readFile(filePath, 'utf8');
    } catch {
      // No cache file
    }
  }

  if (html) {
    const modified = modifyHtml(html);
    return new NextResponse(modified, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=30',
      },
    });
  }

  // Fallback error page
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Sin conexión</title><style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5;color:#333}div{text-align:center;padding:2rem}h2{margin:0 0 0.5rem}p{color:#666;margin:0}button{margin-top:16px;padding:8px 20px;border:none;border-radius:8px;background:#333;color:#fff;cursor:pointer;font-size:14px}button:hover{background:#555}</style></head><body><div><h2>No se pudo cargar la página</h2><p>El dominio no está accesible en este momento.</p><button onclick="location.reload()">Reintentar</button></div></body></html>`,
    {
      status: 502,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  );
}
