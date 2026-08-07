import { createHmac, timingSafeEqual } from "node:crypto";

export interface SessionPayload {
  sub: string; // username
  iat: number; // issued-at, epoch seconds
  exp: number; // expiry, epoch seconds
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function signSession(username: string, secret: string, ttlSeconds = 60 * 60 * 24 * 7): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { sub: username, iat: now, exp: now + ttlSeconds };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encoded, secret);
  return `${encoded}.${signature}`;
}

export function verifySession(token: string | undefined | null, secret: string): SessionPayload | null {
  if (!token) return null;
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return null;

  const encoded = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);
  if (!encoded || !signature) return null;

  const expected = sign(encoded, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof payload.sub !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}
