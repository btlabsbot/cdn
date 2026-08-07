"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { changePassword, AuthError } from "../../lib/apiClient";
import { useRequireAuth } from "../../lib/useRequireAuth";
import Footer from "../../components/Footer";
import PageHeader from "../../components/PageHeader";
import FormField from "../../components/FormField";
import { ErrorBanner, SuccessBanner } from "../../components/Banner";
import CheckingState from "../../components/CheckingState";

export default function SettingsPage() {
  const router = useRouter();
  const { checking, user } = useRequireAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas nuevas no coinciden");
      return;
    }
    if (newPassword.length < 4) {
      setError("La contraseña nueva debe tener al menos 4 caracteres");
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err instanceof AuthError) {
        router.replace("/login");
        return;
      }
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) return <CheckingState />;

  return (
    <main className="inner-page">
      <PageHeader
        eyebrow="CUENTA"
        title="Restablecer contraseña"
        subtitle={
          <>
            Sesión iniciada como <code>{user?.username}</code>
          </>
        }
      />

      <form className="card" onSubmit={handleSubmit}>
        <FormField
          label="Contraseña actual"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          autoFocus
          required
        />
        <FormField
          label="Contraseña nueva"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          minLength={4}
          required
        />
        <FormField
          label="Repite la contraseña nueva"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          minLength={4}
          required
        />

        {error && <ErrorBanner>{error}</ErrorBanner>}
        {success && <SuccessBanner>Contraseña actualizada correctamente.</SuccessBanner>}

        <button type="submit" className="btn btn-primary submit-btn" disabled={submitting}>
          {submitting ? "Guardando…" : "Guardar contraseña"}
        </button>
      </form>

      <style jsx>{`
        .card {
          max-width: 380px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 28px;
          display: flex;
          flex-direction: column;
        }
        .submit-btn {
          margin-top: 4px;
          padding: 12px;
          font-size: 14px;
        }
      `}</style>

      <Footer />
    </main>
  );
}
