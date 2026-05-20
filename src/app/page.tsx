'use client';

export default function Home() {
  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; overflow: hidden; }
        .full-frame {
          position: fixed; top: 0; left: 0;
          width: 100vw; height: 100vh;
          border: none; display: block;
        }
      `}</style>
      <iframe
        src="/api/proxy?path=/"
        className="full-frame"
        title="Page Viewer"
        sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
      />
    </>
  );
}
