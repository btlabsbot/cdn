"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login } from "../../lib/apiClient";
import AuthCard from "../../components/AuthCard";
import FormField from "../../components/FormField";
import { ErrorBanner } from "../../components/Banner";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(username, password);
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      as="form"
      onSubmit={handleSubmit}
      title="Iniciar sesión"
      subtitle="Accede al panel de control de la infraestructura CDN."
    >
      <FormField
        label="Usuario"
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoComplete="username"
        autoFocus
        required
      />
      <FormField
        label="Contraseña"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <button type="submit" className="auth-submit" disabled={submitting}>
        {submitting ? "Entrando…" : "Entrar"}
      </button>

      <Link href="/register" className="auth-link">
        Registrarse
      </Link>
    </AuthCard>
  );
}
