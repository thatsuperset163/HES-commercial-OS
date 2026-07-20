const KEY = "hes-clients-recent-v1";
const MAX = 8;

export function readRecentClientIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.map(String).filter(Boolean).slice(0, MAX)
      : [];
  } catch {
    return [];
  }
}

export function pushRecentClientId(id: string): string[] {
  if (typeof window === "undefined") return [];
  const next = [id, ...readRecentClientIds().filter((x) => x !== id)].slice(
    0,
    MAX,
  );
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore quota
  }
  return next;
}
