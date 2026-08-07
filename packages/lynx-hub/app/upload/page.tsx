"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchAssets, uploadFile, deleteAsset, AuthError, type UploadedAsset } from "../../lib/apiClient";
import { useRequireAuth } from "../../lib/useRequireAuth";
import Footer from "../../components/Footer";
import PageHeader from "../../components/PageHeader";
import { ErrorBanner } from "../../components/Banner";
import CheckingState from "../../components/CheckingState";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadPage() {
  const router = useRouter();
  const { checking } = useRequireAuth();

  const [assets, setAssets] = useState<UploadedAsset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [deletingFilename, setDeletingFilename] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    try {
      const data = await fetchAssets();
      setAssets(data);
      setError(null);
    } catch (err) {
      if (err instanceof AuthError) {
        router.replace("/login");
        return;
      }
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (checking) return;
    reload();
  }, [checking, reload]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await uploadFile(file);
      }
      await reload();
    } catch (err) {
      if (err instanceof AuthError) {
        router.replace("/login");
        return;
      }
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function copyToClipboard(url: string) {
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 1500);
    });
  }

  async function handleDelete(filename: string) {
    if (!confirm(`¿Borrar "${filename}"? El enlace dejará de funcionar de inmediato.`)) return;
    setDeletingFilename(filename);
    try {
      await deleteAsset(filename);
      setAssets((prev) => prev.filter((a) => a.filename !== filename));
      setError(null);
    } catch (err) {
      if (err instanceof AuthError) {
        router.replace("/login");
        return;
      }
      setError((err as Error).message);
    } finally {
      setDeletingFilename(null);
    }
  }

  if (checking) return <CheckingState />;

  return (
    <main className="inner-page">
      <PageHeader
        eyebrow="GESTIÓN DE ARCHIVOS"
        title="Archivos"
        subtitle={
          <>
            Sube un archivo y quedará disponible al instante en <code>/nombre-del-archivo.ext</code>
          </>
        }
      />

      <div
        className={`dropzone ${dragOver ? "dropzone--active" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? (
          <p className="dropzone-title">Subiendo…</p>
        ) : (
          <>
            <p className="dropzone-title">Arrastra archivos aquí o haz clic para elegirlos</p>
            <p className="dropzone-hint">Máximo 50 MB por archivo</p>
          </>
        )}
      </div>

      {error && (
        <ErrorBanner>
          No se pudo completar la operación ({error}). ¿Está corriendo cdn-engine?
        </ErrorBanner>
      )}

      {!error && !loading && assets.length === 0 && (
        <div className="empty">Todavía no has subido ningún archivo.</div>
      )}

      <div className="list">
        {assets.map((asset) => (
          <div key={asset.filename} className="row">
            <div className="row-info">
              <span className="filename">{asset.filename}</span>
              <span className="meta">
                {asset.contentType} · {formatBytes(asset.size)}
              </span>
            </div>
            <div className="row-actions">
              <button className="btn" onClick={() => copyToClipboard(asset.url)}>
                {copiedUrl === asset.url ? "¡copiado!" : "copiar link"}
              </button>
              <button
                className="btn btn-danger"
                disabled={deletingFilename === asset.filename}
                onClick={() => handleDelete(asset.filename)}
              >
                {deletingFilename === asset.filename ? "borrando…" : "borrar"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .dropzone {
          border: 1.5px dashed var(--border);
          border-radius: var(--radius-lg);
          padding: 48px 24px;
          text-align: center;
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease;
          margin-bottom: 24px;
        }
        .dropzone:hover,
        .dropzone--active {
          border-color: var(--accent);
          background: var(--accent-soft);
        }
        .dropzone-title {
          font-size: 15px;
          margin: 0 0 6px;
        }
        .dropzone-hint {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text-muted);
          margin: 0;
        }
        .empty {
          border: 1px dashed var(--border);
          border-radius: var(--radius-md);
          padding: 32px;
          text-align: center;
          color: var(--text-muted);
          font-size: 14px;
        }
        .list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 14px 16px;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .row:hover {
          border-color: var(--border-strong);
          background: var(--surface-hover);
        }
        .row-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .filename {
          font-size: 14px;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .meta {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-muted);
        }
        .row-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          margin-left: 12px;
        }
      `}</style>

      <Footer />
    </main>
  );
}
