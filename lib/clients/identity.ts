import type { WorkClient } from "../work/types.ts";

/** Temporary audit logging for client create / reuse. */
export function logClientEvent(
  event: string,
  detail: Record<string, unknown>,
): void {
  console.info(`[clients] ${event}`, detail);
}

export function normalizeClientEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Digits only; keep last 10 when longer (US-style). */
export function normalizeClientPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export function normalizeClientName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeClientAddress(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export type ClientIdentityInput = {
  name?: string;
  companyName?: string;
  phone?: string;
  email?: string;
  address?: string;
};

/**
 * Stable fingerprint for id-less rows so normalize/hydrate never mint a new
 * random id for the same logical person on every refresh.
 */
export function stableClientFingerprint(input: ClientIdentityInput): string {
  const email = normalizeClientEmail(input.email ?? "");
  const phone = normalizeClientPhone(input.phone ?? "");
  const name = normalizeClientName(input.name ?? "");
  const company = normalizeClientName(input.companyName ?? "");
  const address = normalizeClientAddress(input.address ?? "");
  const raw = email
    ? `e:${email}`
    : phone && (name || company)
      ? `p:${phone}|n:${name || company}`
      : name && address
        ? `n:${name}|a:${address}`
        : `n:${name || company || "unknown"}`;
  return `client-stable-${simpleHash(raw)}`;
}

function simpleHash(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export type ClientMatchReason =
  | "email"
  | "phone_and_name"
  | "phone_and_company"
  | "name_and_address"
  | "id";

export type ClientMatch = {
  client: WorkClient;
  reason: ClientMatchReason;
};

/** Find an existing client that represents the same real-world person/business. */
export function findExistingClient(
  clients: WorkClient[],
  input: ClientIdentityInput,
  options?: { excludeId?: string },
): ClientMatch | null {
  const email = normalizeClientEmail(input.email ?? "");
  const phone = normalizeClientPhone(input.phone ?? "");
  const name = normalizeClientName(input.name ?? "");
  const company = normalizeClientName(input.companyName ?? "");
  const address = normalizeClientAddress(input.address ?? "");

  const pool = options?.excludeId
    ? clients.filter((c) => c.id !== options.excludeId)
    : clients;

  if (email) {
    const hit = pool.find(
      (c) => normalizeClientEmail(c.email) === email && c.email.trim(),
    );
    if (hit) return { client: hit, reason: "email" };
  }

  if (phone.length >= 7) {
    const phoneMatches = pool.filter(
      (c) => normalizeClientPhone(c.phone) === phone,
    );
    if (name) {
      const byName = phoneMatches.find(
        (c) => normalizeClientName(c.name) === name,
      );
      if (byName) return { client: byName, reason: "phone_and_name" };
    }
    if (company) {
      const byCo = phoneMatches.find(
        (c) => normalizeClientName(c.companyName) === company,
      );
      if (byCo) return { client: byCo, reason: "phone_and_company" };
    }
    // Phone alone is enough when only one client has that number.
    if (phoneMatches.length === 1 && phoneMatches[0]) {
      return { client: phoneMatches[0], reason: "phone_and_name" };
    }
  }

  if (name && address) {
    const hit = pool.find(
      (c) =>
        normalizeClientName(c.name) === name &&
        normalizeClientAddress(c.address) === address &&
        c.address.trim(),
    );
    if (hit) return { client: hit, reason: "name_and_address" };
  }

  return null;
}

function richness(client: WorkClient): number {
  return [
    client.email,
    client.phone,
    client.address,
    client.companyName,
    client.billingAddress,
    client.notes,
    client.city,
    client.tags.join(","),
  ].filter((v) => String(v || "").trim()).length;
}

function preferSurvivor(a: WorkClient, b: WorkClient): WorkClient {
  const aTime = a.createdAt || "";
  const bTime = b.createdAt || "";
  if (aTime && bTime && aTime !== bTime) {
    return aTime < bTime ? a : b;
  }
  return richness(a) >= richness(b) ? a : b;
}

function mergeClientFields(survivor: WorkClient, donor: WorkClient): WorkClient {
  const pick = (a: string, b: string) => (a.trim() ? a : b);
  const tags = [...new Set([...survivor.tags, ...donor.tags].map((t) => t.trim()).filter(Boolean))];
  const properties =
    survivor.properties.length >= donor.properties.length
      ? survivor.properties
      : donor.properties;
  return {
    ...survivor,
    name: pick(survivor.name, donor.name),
    companyName: pick(survivor.companyName, donor.companyName),
    phone: pick(survivor.phone, donor.phone),
    email: pick(survivor.email, donor.email),
    address: pick(survivor.address, donor.address),
    billingAddress: pick(survivor.billingAddress, donor.billingAddress),
    city: pick(survivor.city, donor.city),
    preferredContact: survivor.preferredContact || donor.preferredContact,
    notes: pick(survivor.notes, donor.notes),
    tags,
    properties,
    favorite: survivor.favorite || donor.favorite,
    status: survivor.status === "active" || donor.status === "active" ? "active" : survivor.status,
    createdAt:
      survivor.createdAt && donor.createdAt
        ? survivor.createdAt < donor.createdAt
          ? survivor.createdAt
          : donor.createdAt
        : survivor.createdAt || donor.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

export type DedupeClientsResult = {
  clients: WorkClient[];
  /** Maps removed duplicate ids → surviving client id */
  idMap: Record<string, string>;
  removedCount: number;
};

/**
 * Collapse duplicate clients into one survivor per identity and report id remaps.
 */
export function dedupeClients(clients: WorkClient[]): DedupeClientsResult {
  const surviving: WorkClient[] = [];
  const idMap: Record<string, string> = {};
  let removedCount = 0;

  for (const candidate of clients) {
    const match = findExistingClient(surviving, candidate);
    if (!match) {
      surviving.push(candidate);
      continue;
    }

    const winner = preferSurvivor(match.client, candidate);
    const loser = winner.id === match.client.id ? candidate : match.client;
    const merged = mergeClientFields(winner, loser);
    // Keep winner's id as the canonical record id.
    merged.id = winner.id;

    const idx = surviving.findIndex((c) => c.id === match.client.id);
    if (idx >= 0) surviving[idx] = merged;

    if (loser.id !== winner.id) {
      idMap[loser.id] = winner.id;
      removedCount += 1;
      logClientEvent("dedupe_removed_duplicate", {
        survivorId: winner.id,
        removedId: loser.id,
        reason: match.reason,
        name: winner.name,
      });
    }
  }

  // Collapse transitive maps (a→b, b→c) just in case.
  for (const [from, to] of Object.entries(idMap)) {
    let cursor = to;
    const seen = new Set<string>([from]);
    while (idMap[cursor] && !seen.has(cursor)) {
      seen.add(cursor);
      cursor = idMap[cursor]!;
    }
    idMap[from] = cursor;
  }

  return { clients: surviving, idMap, removedCount };
}
