import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { readFile } from 'fs/promises';
import { join } from 'path';

const TARGET_BASE = 'https://n186t36xx-.space.z.ai';

// In-memory cache
let cachedHtml: string | null = null;
let cacheTimestamp: number = 0;

async function fetchDirect(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok || response.status === 500) {
      // Some pages return 500 but still have HTML content
      const text = await response.text();
      if (text && text.length > 50) return text;
    }
  } catch {
    // Domain likely not resolvable
  }
  return null;
}

async function fetchViaPageReader(url: string): Promise<string | null> {
  try {
    const zai = await ZAI.create();
    const result = await zai.functions.invoke('page_reader', { url });
    if (result.data?.html && result.data.html.length > 50) {
      return result.data.html;
    }
  } catch {
    // Page reader failed
  }
  return null;
}

async function readLocalCache(): Promise<string | null> {
  try {
    const filePath = join(process.cwd(), 'cache', 'index.html');
    const html = await readFile(filePath, 'utf8');
    return html || null;
  } catch {
    return null;
  }
}

function modifyHtml(html: string): string {
  let modified = html;

  // Inject <base> tag for relative URLs
  if (modified.includes('<head>')) {
    modified = modified.replace('<head>', `<head><base href="${TARGET_BASE}/">`);
  } else if (modified.includes('<html')) {
    modified = modified.replace(/<html([^>]*)>/, `<html$1><head><base href="${TARGET_BASE}/"></head>`);
  }

  // Inject link click interceptor for navigation
  const interceptorScript = `
<script>
(function() {
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a');
    if (link && link.href) {
      var href = link.getAttribute('href');
      if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:')) {
        e.preventDefault();
        window.parent.postMessage({ type: 'proxy-navigate', url: link.href }, '*');
      }
    }
  });
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const proxyPath = searchParams.get('path') || '/';
  const targetUrl = `${TARGET_BASE}${proxyPath.startsWith('/') ? proxyPath : '/' + proxyPath}`;

  let html: string | null = null;

  // Method 1: Direct fetch from our server
  html = await fetchDirect(targetUrl);

  // Method 2: Page reader (JINA-based)
  if (!html) {
    html = await fetchViaPageReader(targetUrl);
  }

  // Update in-memory cache if we got fresh content
  if (html) {
    cachedHtml = html;
    cacheTimestamp = Date.now();
  }

  // Method 3: In-memory cache
  if (!html && cachedHtml) {
    html = cachedHtml;
  }

  // Method 4: Local file cache (ALWAYS works as last resort)
  if (!html) {
    html = await readLocalCache();
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

  // Absolute fallback
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Sin conexión</title><style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5;color:#333}div{text-align:center;padding:2rem}h2{margin:0 0 0.5rem}p{color:#666;margin:0}button{margin-top:16px;padding:8px 20px;border:none;border-radius:8px;background:#333;color:#fff;cursor:pointer;font-size:14px}button:hover{background:#555}</style></head><body><div><h2>No se pudo cargar la página</h2><p>El dominio no está accesible en este momento.</p><button onclick="window.parent.postMessage({type:'proxy-retry'},'*')">Reintentar</button></div></body></html>`,
    {
      status: 502,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  );
}
