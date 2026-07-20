import type { WorkClient } from "../work/types.ts";

/** Display name as stored (single name field — no first/last split in schema). */
export function clientDisplayName(client: WorkClient): string {
  return client.name.trim() || "Untitled client";
}

/**
 * Sort key: prefer last token of a multi-word name (Hal Fisher → fisher),
 * otherwise the full name. Ignores leading spaces and case.
 */
export function clientSortName(client: WorkClient): string {
  const name = clientDisplayName(client).replace(/^\s+/, "");
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return parts[parts.length - 1]!.toLowerCase();
  }
  return name.toLowerCase();
}

export function clientInitials(client: WorkClient): string {
  const parts = clientDisplayName(client).split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

/** Best secondary line for a compact directory row. */
export function clientSecondaryDetail(client: WorkClient): string {
  if (client.address.trim()) return client.address.trim();
  if (client.phone.trim()) return client.phone.trim();
  if (client.email.trim()) return client.email.trim();
  return "No contact details";
}

export function clientSectionLetter(client: WorkClient): string {
  const key = clientSortName(client);
  const ch = key.charAt(0).toUpperCase();
  if (ch >= "A" && ch <= "Z") return ch;
  return "#";
}

export function matchesClientQuery(client: WorkClient, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    client.name,
    client.phone,
    client.email,
    client.address,
    client.notes,
    ...(client.properties ?? []).flatMap((p) => [p.line, p.label]),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export type ClientSection = {
  letter: string;
  clients: WorkClient[];
};

export function groupClientsAlphabetically(clients: WorkClient[]): ClientSection[] {
  const sorted = [...clients].sort((a, b) => {
    const sa = clientSortName(a);
    const sb = clientSortName(b);
    if (sa !== sb) return sa.localeCompare(sb);
    return clientDisplayName(a).localeCompare(clientDisplayName(b));
  });

  const map = new Map<string, WorkClient[]>();
  for (const client of sorted) {
    const letter = clientSectionLetter(client);
    const bucket = map.get(letter) ?? [];
    bucket.push(client);
    map.set(letter, bucket);
  }

  const letters = [...map.keys()].sort((a, b) => {
    if (a === "#") return 1;
    if (b === "#") return -1;
    return a.localeCompare(b);
  });

  return letters.map((letter) => ({
    letter,
    clients: map.get(letter) ?? [],
  }));
}

export function formatClientSince(iso: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
