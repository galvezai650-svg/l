'use client';

import { useEffect, useState, useCallback } from 'react';

const TARGET_BASE = 'https://n186t36xx-.space-z.ai';

export default function Home() {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState('/');
  const [retryCount, setRetryCount] = useState(0);

  const fetchPage = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/proxy?path=${encodeURIComponent(path)}`);
      const text = await res.text();
      if (text) {
        setHtml(text);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPage(currentPath);
  }, [currentPath, retryCount, fetchPage]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'proxy-navigate' && event.data?.url) {
        try {
          const urlObj = new URL(event.data.url);
          const path = urlObj.pathname + urlObj.search;
          if (urlObj.origin === new URL(TARGET_BASE).origin) {
            setCurrentPath(path);
          } else {
            window.open(event.data.url, '_blank', 'noopener,noreferrer');
          }
        } catch {
          window.open(event.data.url as string, '_blank', 'noopener,noreferrer');
        }
      }
      if (event.data?.type === 'proxy-retry') {
        setRetryCount((c) => c + 1);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; overflow: hidden; }
        .full-frame { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; border: none; display: block; }
        .loader-overlay {
          position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
          display: flex; align-items: center; justify-content: center;
          background: #fff; z-index: 9999; flex-direction: column; gap: 12px;
        }
        .spinner {
          width: 36px; height: 36px; border: 3px solid #e0e0e0;
          border-top-color: #333; border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .error-screen {
          display: flex; align-items: center; justify-content: center;
          height: 100vh; font-family: system-ui; color: #666;
          flex-direction: column; gap: 12px;
        }
        .retry-btn {
          padding: 8px 20px; border: none; border-radius: 8px;
          background: #333; color: #fff; cursor: pointer; font-size: 14px;
        }
        .retry-btn:hover { background: #555; }
      `}</style>
      {loading && (
        <div className="loader-overlay">
          <div className="spinner" />
          <span style={{ color: '#666', fontSize: '14px' }}>Cargando página...</span>
        </div>
      )}
      {html && (
        <iframe
          srcDoc={html}
          className="full-frame"
          title="Page Viewer"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      )}
      {!html && !loading && (
        <div className="error-screen">
          <p>No se pudo cargar la página</p>
          <button className="retry-btn" onClick={() => setRetryCount((c) => c + 1)}>
            Reintentar
          </button>
        </div>
      )}
    </>
  );
}
