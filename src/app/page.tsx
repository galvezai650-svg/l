'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

const TARGET_BASE = 'https://n186t36xx-.space-z.ai';

export default function Home() {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState('/');
  const [retryCount, setRetryCount] = useState(0);

  const fetchPage = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/proxy?path=${encodeURIComponent(path)}`);
      const text = await res.text();
      setHtml(text);
    } catch {
      setHtml(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount and when path changes
  useEffect(() => {
    fetchPage(currentPath);
  }, [currentPath, retryCount, fetchPage]);

  // Listen for messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'proxy-navigate' && event.data?.url) {
        try {
          const urlObj = new URL(event.data.url);
          const path = urlObj.pathname + urlObj.search;
          if (urlObj.origin === new URL(TARGET_BASE).origin) {
            setCurrentPath(path);
          } else {
            // External link - open in new tab
            window.open(event.data.url, '_blank', 'noopener,noreferrer');
          }
        } catch {
          window.open(event.data.url, '_blank', 'noopener,noreferrer');
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
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }}>
      {loading && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#fff', zIndex: 9999, flexDirection: 'column', gap: '12px'
        }}>
          <Loader2 style={{ width: 32, height: 32, animation: 'spin 1s linear infinite', color: '#666' }} />
          <span style={{ color: '#666', fontSize: '14px' }}>Cargando página...</span>
        </div>
      )}
      {html && (
        <iframe
          srcDoc={html}
          style={{ width: '100vw', height: '100vh', border: 'none', display: 'block' }}
          title="Page Viewer"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      )}
      {!html && !loading && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100vh', fontFamily: 'system-ui', color: '#666',
          flexDirection: 'column', gap: '12px'
        }}>
          <p>No se pudo cargar la página</p>
          <button
            onClick={() => setRetryCount((c) => c + 1)}
            style={{
              padding: '8px 20px', border: 'none', borderRadius: '8px',
              background: '#333', color: '#fff', cursor: 'pointer', fontSize: '14px'
            }}
          >
            Reintentar
          </button>
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
