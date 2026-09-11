export interface IntEnvOptions {
  min?: number;
  max?: number;
}

/** Strict integer env parsing: throws on NaN / non-finite / out of range. */
export function parseIntEnv(name: string, raw: string | undefined, fallback: number, opts: IntEnvOptions = {}): number {
  const text = raw ?? String(fallback);
  const value = Number.parseInt(text, 10);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid env var ${name}=${JSON.stringify(text)}: expected integer`);
  }
  if (opts.min !== undefined && value < opts.min) {
    throw new Error(`Invalid env var ${name}=${value}: must be >= ${opts.min}`);
  }
  if (opts.max !== undefined && value > opts.max) {
    throw new Error(`Invalid env var ${name}=${value}: must be <= ${opts.max}`);
  }
  return value;
}

/** Rejects weak defaults in production; warns in non-prod. */
export function requireStrongSecret(name: string, value: string | undefined, fallback: string): string {
  const secret = value ?? fallback;
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && (!value || value === fallback || value.length < 32)) {
    throw new Error(`${name} must be explicitly set to a random string (>=32 chars) in production`);
  }
  return secret;
}
