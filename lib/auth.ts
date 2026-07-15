export const AUTH_COOKIE = "hes_board_auth";

function getPin(): string {
  return process.env.APP_PIN?.trim() || "twins6";
}

function getSecret(): string {
  return process.env.AUTH_SECRET?.trim() || `hes-secret-${getPin()}`;
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

async function hmacHex(message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return toHex(sig);
}

export async function signToken(): Promise<string> {
  const payload = "ok";
  const sig = await hmacHex(payload);
  return `${payload}.${sig}`;
}

export async function verifyToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const expected = await signToken();
  return timingSafeEqualStr(token, expected);
}

export function checkPin(pin: string): boolean {
  return timingSafeEqualStr(pin, getPin());
}
