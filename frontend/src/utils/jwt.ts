/**
 * Minimal JWT helpers (decode + expiration checks).
 *
 * NOTE: This does NOT verify signatures. It's intended for client-side
 * UX decisions (e.g., "is the token expired?") and test/dev flows.
 */

export type JwtPayload = Record<string, unknown> & {
  exp?: number;
  iat?: number;
};

function base64UrlToBase64(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (base64.length % 4)) % 4;
  return base64 + "=".repeat(padLength);
}

function decodeBase64ToString(base64: string): string {
  // Browser path
  if (typeof atob === "function") {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  // Node.js fallback (useful for unit tests / server environments)
  const NodeBuffer = (globalThis as unknown as { Buffer?: unknown }).Buffer as
    | {
        from(
          data: string,
          encoding: "base64",
        ): { toString(enc: "utf-8"): string };
      }
    | undefined;
  if (NodeBuffer) {
    return NodeBuffer.from(base64, "base64").toString("utf-8");
  }

  throw new Error("No base64 decoder available in this environment");
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const payloadBase64 = base64UrlToBase64(parts[1]);
    const payloadJson = decodeBase64ToString(payloadBase64);
    const parsed = JSON.parse(payloadJson) as JwtPayload;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function isJwtExpired(
  token: string,
  leewaySeconds: number = 60,
): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return true;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now + leewaySeconds;
}
