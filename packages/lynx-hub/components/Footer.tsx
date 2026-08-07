"use client";

import Link from "next/link";

export default function Footer({ minimal = false }: { minimal?: boolean }) {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div className="footer-brand">
          <span className="brand-mark" aria-hidden="true" />
          LynxNodes
          <span className="footer-meta">· Infraestructura CDN interna</span>
        </div>

        {!minimal && (
          <nav className="footer-links">
            <Link href="/dashboard">Panel</Link>
            <span className="sep">·</span>
            <Link href="/settings">Cambiar contraseña</Link>
            <span className="sep">·</span>
            <a href="https://docs.lynxnodes.es" target="_blank" rel="noopener noreferrer">
              Documentación
            </a>
            <span className="sep">·</span>
            <a href="mailto:info@lynxnodes.es">Soporte</a>
          </nav>
        )}
      </div>

      <div className="footer-bottom">
        <span>© {year} LynxNodes. Todos los derechos reservados.</span>
        <a href="https://lynxnodes.es" target="_blank" rel="noopener noreferrer">
          lynxnodes.es
        </a>
      </div>

      <style jsx>{`
        .site-footer {
          max-width: 1100px;
          margin: 64px auto 0;
          padding: 20px 24px 32px;
          border-top: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 14px;
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text-faint);
        }
        .footer-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }
        .footer-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-muted);
          letter-spacing: 0.04em;
        }
        .footer-meta {
          color: var(--text-faint);
          font-weight: 400;
        }
        .brand-mark {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent);
          box-shadow: 0 0 6px var(--accent);
        }
        .footer-links {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .footer-links :global(a) {
          color: var(--text-faint);
          text-decoration: none;
          transition: color 0.15s ease;
        }
        .footer-links :global(a:hover) {
          color: var(--accent);
        }
        .sep {
          color: var(--border-strong);
        }
        .footer-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          padding-top: 14px;
          border-top: 1px solid var(--border);
          color: var(--text-faint);
        }
        .footer-bottom a {
          color: var(--text-faint);
          text-decoration: none;
          transition: color 0.15s ease;
        }
        .footer-bottom a:hover {
          color: var(--accent);
        }
      `}</style>
    </footer>
  );
}
