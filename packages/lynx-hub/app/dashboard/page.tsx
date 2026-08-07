"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  fetchNodes,
  fetchAssets,
  deleteAsset,
  logout,
  AuthError,
  type Node as LynxNode,
  type UploadedAsset,
} from "../../lib/apiClient";
import { useRequireAuth } from "../../lib/useRequireAuth";
import Footer from "../../components/Footer";
import CheckingState from "../../components/CheckingState";
import { ErrorBanner } from "../../components/Banner";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_COLOR: Record<string, string> = {
  online: "var(--signal-online)",
  degraded: "var(--signal-degraded)",
  offline: "var(--signal-offline)",
};

const STATUS_LABEL: Record<string, string> = {
  online: "en línea",
  degraded: "degradado",
  offline: "fuera de línea",
};

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 5) return "justo ahora";
  if (seconds < 60) return `hace ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `hace ${hours}h`;
}

function StatusDot({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? "var(--text-muted)";
  return (
    <span className="dot-wrap">
      {status === "online" && (
        <span className="radar-ring" style={{ borderColor: color }} />
      )}
      <span className="dot" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      <style jsx>{`
        .dot-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 14px;
          height: 14px;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          z-index: 1;
        }
        .radar-ring {
          position: absolute;
          inset: 0;
          border: 1.5px solid;
          border-radius: 50%;
          animation: radar-pulse 2.4s ease-out infinite;
        }
      `}</style>
    </span>
  );
}

function NodeCard({ node }: { node: LynxNode }) {
  const hitPct = Math.round(node.cacheHitRate * 100);
  const color = STATUS_COLOR[node.status] ?? "var(--text-muted)";

  return (
    <div className="card" style={{ borderTopColor: color }}>
      <div className="card-top">
        <div className="eyebrow">NODO</div>
        <div className="status-cluster">
          <div className="status-label" style={{ color }}>
            <StatusDot status={node.status} />
            {STATUS_LABEL[node.status] ?? node.status}
          </div>
          <div className="mini-stats">
            <span title="capacidad de disco usada">
              disco {Math.round(node.diskUsagePct)}%
            </span>
            <span className="mini-sep">·</span>
            <span title="latencia con el gateway">{Math.round(node.latencyMs)}ms</span>
          </div>
        </div>
      </div>

      <div className="hostname">{node.hostname}</div>
      <div className="region">{node.region}</div>

      <div className="metric">
        <div className="metric-label">
          <span>tasa de acierto de caché</span>
          <span className="metric-value">{hitPct}%</span>
        </div>
        <div className="bar-track">
          <div className="bar-fill" style={{ width: `${hitPct}%`, background: color }} />
        </div>
      </div>

      <div className="footer">
        <span>última señal {timeAgo(node.lastSeen)}</span>
        <span className="node-id" title={node.id}>
          {node.id.slice(0, 8)}
        </span>
      </div>

      <style jsx>{`
        .card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-top: 2px solid var(--border);
          border-radius: var(--radius-md);
          padding: 20px;
          transition: border-color 0.15s ease, transform 0.15s ease, background 0.15s ease;
        }
        .card:hover {
          border-color: var(--border-strong);
          background: var(--surface-hover);
          transform: translateY(-1px);
        }
        .card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .eyebrow {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.12em;
          color: var(--text-faint);
        }
        .status-cluster {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }
        .status-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-mono);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .mini-stats {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-muted);
        }
        .mini-sep {
          color: var(--border-strong);
        }
        .hostname {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 2px;
          letter-spacing: -0.01em;
        }
        .region {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 18px;
        }
        .metric-label {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 6px;
        }
        .metric-value {
          font-family: var(--font-mono);
          color: var(--text);
        }
        .bar-track {
          height: 5px;
          border-radius: 3px;
          background: var(--bg-soft);
          overflow: hidden;
        }
        .bar-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.4s ease;
        }
        .footer {
          margin-top: 18px;
          padding-top: 14px;
          border-top: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-muted);
        }
        .node-id {
          color: var(--text-faint);
        }
      `}</style>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { checking } = useRequireAuth();

  const [nodes, setNodes] = useState<LynxNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [assets, setAssets] = useState<UploadedAsset[]>([]);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [deletingFilename, setDeletingFilename] = useState<string | null>(null);

  useEffect(() => {
    if (checking) return;
    let cancelled = false;

    async function poll() {
      try {
        const data = await fetchNodes();
        if (!cancelled) {
          setNodes(data);
          setError(null);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof AuthError) {
          router.replace("/login");
          return;
        }
        setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    poll();
    const interval = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [checking, router]);

  const loadAssets = useCallback(async () => {
    try {
      const data = await fetchAssets();
      setAssets(data);
      setAssetsError(null);
    } catch (err) {
      if (err instanceof AuthError) {
        router.replace("/login");
        return;
      }
      setAssetsError((err as Error).message);
    } finally {
      setAssetsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (checking) return;
    let cancelled = false;
    loadAssets();
    const interval = setInterval(() => {
      if (!cancelled) loadAssets();
    }, 6000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [checking, loadAssets]);

  async function handleDelete(filename: string) {
    if (!confirm(`¿Borrar "${filename}"? Esta acción no se puede deshacer.`)) return;
    setDeletingFilename(filename);
    try {
      await deleteAsset(filename);
      setAssets((prev) => prev.filter((a) => a.filename !== filename));
      setAssetsError(null);
    } catch (err) {
      if (err instanceof AuthError) {
        router.replace("/login");
        return;
      }
      setAssetsError((err as Error).message);
    } finally {
      setDeletingFilename(null);
    }
  }

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  if (checking) return <CheckingState />;

  const onlineCount = nodes.filter((n) => n.status === "online").length;
  const avgHitRate =
    nodes.length > 0
      ? Math.round((nodes.reduce((sum, n) => sum + n.cacheHitRate, 0) / nodes.length) * 100)
      : 0;

  return (
    <main className="page">
      <header className="header">
        <div className="radar-sweep-bg" aria-hidden="true" />
        <div className="header-content">
          <div>
            <div className="eyebrow">LYNXNODES · CONSOLE</div>
            <h1>Estado en vivo</h1>
            <p className="subtitle">Operación en tiempo real de la infraestructura CDN, nodo a nodo</p>
          </div>
          <div className="summary">
            <div className="summary-item">
              <span className="summary-value">{onlineCount}/{nodes.length}</span>
              <span className="summary-label">nodos en línea</span>
            </div>
            <div className="summary-item">
              <span className="summary-value">{avgHitRate}%</span>
              <span className="summary-label">acierto prom.</span>
            </div>
            <Link href="/settings" className="btn">
              Cuenta
            </Link>
            <button className="btn" onClick={handleLogout}>
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      {error && (
        <ErrorBanner>No se puede conectar con api-gateway ({error}). ¿Está corriendo?</ErrorBanner>
      )}

      {!error && !loading && nodes.length === 0 && (
        <div className="empty">
          Todavía no hay nodos reportando. Levanta una instancia de cdn-engine
          con <code>GATEWAY_URL</code> apuntando a este gateway para verlo aparecer aquí.
        </div>
      )}

      <div className="grid">
        {nodes.map((node) => (
          <NodeCard key={node.id} node={node} />
        ))}
      </div>

      <section className="assets-panel">
        <div className="assets-header">
          <h2>Archivos subidos</h2>
          <Link href="/upload" className="btn">
            Subir archivos →
          </Link>
        </div>

        {assetsError && (
          <ErrorBanner>No se puede conectar con cdn-engine ({assetsError}). ¿Está corriendo?</ErrorBanner>
        )}

        {!assetsError && !assetsLoading && assets.length === 0 && (
          <div className="empty">Todavía no se subió ningún archivo.</div>
        )}

        {assets.length > 0 && (
          <div className="asset-list">
            {assets.map((asset) => (
              <div key={asset.filename} className="asset-row">
                <div className="asset-info">
                  <span className="asset-filename">{asset.filename}</span>
                  <span className="asset-meta">
                    {asset.contentType} · {formatBytes(asset.size)}
                  </span>
                </div>
                <button
                  className="btn btn-danger"
                  disabled={deletingFilename === asset.filename}
                  onClick={() => handleDelete(asset.filename)}
                >
                  {deletingFilename === asset.filename ? "borrando…" : "borrar"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <style jsx>{`
        .page {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 24px;
        }
        .header {
          position: relative;
          overflow: hidden;
          margin: 0 -24px 40px;
          padding: 40px 24px 32px;
          border-bottom: 1px solid var(--border);
        }
        .header-content {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 20px;
        }
        .eyebrow {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.14em;
          color: var(--accent);
          margin-bottom: 10px;
        }
        h1 {
          font-size: 34px;
          font-weight: 700;
          margin: 0;
          letter-spacing: -0.02em;
        }
        .subtitle {
          font-family: var(--font-mono);
          font-size: 13px;
          color: var(--text-muted);
          margin: 8px 0 0;
        }
        .summary {
          display: flex;
          align-items: center;
          gap: 28px;
        }
        .summary-item {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }
        .summary-value {
          font-family: var(--font-mono);
          font-size: 24px;
          font-weight: 600;
        }
        .summary-label {
          font-size: 11px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 16px;
        }
        .empty {
          border: 1px dashed var(--border);
          border-radius: var(--radius-md);
          padding: 32px;
          text-align: center;
          color: var(--text-muted);
          font-size: 14px;
        }
        .empty code {
          font-family: var(--font-mono);
          background: var(--bg-soft);
          padding: 2px 6px;
          border-radius: 4px;
        }
        .assets-panel {
          margin-top: 48px;
        }
        .assets-header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .assets-header h2 {
          font-size: 18px;
          font-weight: 600;
          margin: 0;
        }
        .asset-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .asset-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 14px 16px;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .asset-row:hover {
          border-color: var(--border-strong);
          background: var(--surface-hover);
        }
        .asset-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .asset-filename {
          font-size: 14px;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .asset-meta {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-muted);
        }
      `}</style>

      <Footer />
    </main>
  );
}
