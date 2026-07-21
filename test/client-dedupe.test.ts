import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dedupeClients,
  findExistingClient,
  stableClientFingerprint,
} from "../lib/clients/identity.ts";
import {
  createClient,
  findOrCreateClient,
  normalizeClients,
} from "../lib/work/model.ts";
import type { WorkClient } from "../lib/work/types.ts";

function client(partial: Partial<WorkClient> & { name: string; id: string }): WorkClient {
  return {
    id: partial.id,
    name: partial.name,
    companyName: partial.companyName ?? "",
    phone: partial.phone ?? "",
    email: partial.email ?? "",
    address: partial.address ?? "",
    billingAddress: partial.billingAddress ?? "",
    properties: partial.properties ?? [],
    city: partial.city ?? "",
    clientType: partial.clientType ?? "residential",
    preferredContact: partial.preferredContact ?? "",
    tags: partial.tags ?? [],
    favorite: partial.favorite ?? false,
    notes: partial.notes ?? "",
    status: partial.status ?? "active",
    createdAt: partial.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: partial.updatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

describe("client identity / dedupe", () => {
  it("matches by email regardless of casing", () => {
    const existing = [
      client({ id: "a", name: "Hal", email: "hal@hes.com" }),
    ];
    const match = findExistingClient(existing, {
      name: "Other",
      email: "HAL@hes.com",
    });
    assert.equal(match?.client.id, "a");
    assert.equal(match?.reason, "email");
  });

  it("matches by phone + name", () => {
    const existing = [
      client({ id: "a", name: "Hal Fisher", phone: "(336) 555-0100" }),
    ];
    const match = findExistingClient(existing, {
      name: "Hal Fisher",
      phone: "3365550100",
    });
    assert.equal(match?.client.id, "a");
  });

  it("dedupe collapses two email twins and maps removed id", () => {
    const { clients, idMap, removedCount } = dedupeClients([
      client({
        id: "old",
        name: "Hal",
        email: "hal@hes.com",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
      client({
        id: "dup",
        name: "Hal Fisher",
        email: "hal@hes.com",
        phone: "555",
        createdAt: "2026-06-01T00:00:00.000Z",
      }),
    ]);
    assert.equal(removedCount, 1);
    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.id, "old");
    assert.equal(idMap.dup, "old");
    assert.equal(clients[0]?.phone, "555");
  });

  it("stable fingerprint is deterministic across normalize passes", () => {
    const a = stableClientFingerprint({
      name: "Hal",
      email: "hal@hes.com",
    });
    const b = stableClientFingerprint({
      name: "Hal",
      email: "hal@hes.com",
    });
    assert.equal(a, b);
  });

  it("normalizeClients does not mint random ids for id-less rows", () => {
    const first = normalizeClients([
      { name: "Hal Fisher", email: "hal@hes.com", phone: "336" },
    ]);
    const second = normalizeClients([
      { name: "Hal Fisher", email: "hal@hes.com", phone: "336" },
    ]);
    assert.equal(first[0]?.id, second[0]?.id);
    assert.ok(first[0]?.id.startsWith("client-stable-"));
  });

  it("findOrCreateClient reuses instead of inserting", () => {
    const existing = [createClient({ name: "Amy", email: "amy@x.com" })];
    const again = findOrCreateClient(
      existing,
      { name: "Amy Smith", email: "amy@x.com" },
      "test",
    );
    assert.equal(again.created, false);
    assert.equal(again.client.id, existing[0]?.id);
  });

  it("findOrCreateClient creates only when no match", () => {
    const existing = [createClient({ name: "Amy", email: "amy@x.com" })];
    const next = findOrCreateClient(
      existing,
      { name: "Bob", email: "bob@x.com" },
      "test",
    );
    assert.equal(next.created, true);
    assert.notEqual(next.client.id, existing[0]?.id);
  });
});
