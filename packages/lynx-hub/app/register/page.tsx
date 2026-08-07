"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { register, fetchAuthConfig } from "../../lib/apiClient";
import AuthCard from "../../components/AuthCard";
import FormField from "../../components/FormField";
import { ErrorBanner } from "../../components/Banner";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkingConfig, setCheckingConfig] = useState(true);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);

  useEffect(() => {
    fetchAuthConfig()
      .then((config) => setRegistrationEnabled(config.registrationEnabled))
      .catch(() => setRegistrationEnabled(false))
      .finally(() => setCheckingConfig(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setSubmitting(true);
    try {
      await register(username, password);
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingConfig) {
    return <AuthCard title="Crear cuenta" subtitle="Comprobando…" />;
  }

  if (!registrationEnabled) {
    return (
      <AuthCard
        title="Registro desactivado"
        subtitle="La creación de cuentas nuevas está desactivada. Pide a un administrador que te cree una cuenta, o inicia sesión si ya tienes una."
      >
        <Link href="/login" className="auth-submit">
          Ir a iniciar sesión
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      as="form"
      onSubmit={handleSubmit}
      title="Crear cuenta"
      subtitle="Regístrate para acceder al panel de control."
    >
      <FormField
        label="Usuario"
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoComplete="username"
        autoFocus
        minLength={3}
        maxLength={32}
        required
      />
      <FormField
        label="Contraseña"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        minLength={4}
        required
      />
      <FormField
        label="Repite la contraseña"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        autoComplete="new-password"
        minLength={4}
        required
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <button type="submit" className="auth-submit" disabled={submitting}>
        {submitting ? "Creando cuenta…" : "Crear cuenta"}
      </button>

      <Link href="/login" className="auth-link auth-link--text">
        ¿Ya tienes cuenta? Inicia sesión
      </Link>
    </AuthCard>
  );
}
