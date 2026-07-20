import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clientDisplayName,
  clientInitials,
  clientSecondaryDetail,
  clientSortName,
  groupClientsAlphabetically,
  matchesClientQuery,
} from "../lib/clients/display.ts";
import type { WorkClient } from "../lib/work/types.ts";

function client(partial: Partial<WorkClient> & { name: string }): WorkClient {
  return {
    id: partial.id ?? "c1",
    name: partial.name,
    phone: partial.phone ?? "",
    email: partial.email ?? "",
    address: partial.address ?? "",
    properties: partial.properties ?? [],
    notes: partial.notes ?? "",
    status: partial.status ?? "active",
    createdAt: partial.createdAt ?? "",
    updatedAt: partial.updatedAt ?? "",
  };
}

describe("client directory display helpers", () => {
  it("sorts multi-word names by last token", () => {
    assert.equal(clientSortName(client({ name: "Hal Fisher" })), "fisher");
    assert.equal(clientSortName(client({ name: "Acme LLC" })), "llc");
  });

  it("builds initials from first and last tokens", () => {
    assert.equal(clientInitials(client({ name: "Hal Fisher" })), "HF");
    assert.equal(clientInitials(client({ name: "Tim" })), "TI");
  });

  it("prefers address as secondary detail", () => {
    assert.equal(
      clientSecondaryDetail(
        client({
          name: "Hal",
          address: "3935 Leinbach Dr",
          phone: "555",
        }),
      ),
      "3935 Leinbach Dr",
    );
    assert.equal(
      clientSecondaryDetail(client({ name: "Empty" })),
      "No contact details",
    );
  });

  it("groups alphabetically by sort letter", () => {
    const sections = groupClientsAlphabetically([
      client({ id: "1", name: "Tim Grandinetti" }),
      client({ id: "2", name: "Hal Fisher" }),
      client({ id: "3", name: "Ann Adams" }),
    ]);
    assert.deepEqual(
      sections.map((s) => s.letter),
      ["A", "F", "G"],
    );
    assert.equal(sections[1]?.clients[0]?.name, "Hal Fisher");
  });

  it("matches search across phone and address", () => {
    const row = client({
      name: "Hal Fisher",
      phone: "336-555-0100",
      address: "Leinbach",
    });
    assert.equal(matchesClientQuery(row, "lein"), true);
    assert.equal(matchesClientQuery(row, "336"), true);
    assert.equal(matchesClientQuery(row, "zzz"), false);
    assert.equal(clientDisplayName(row), "Hal Fisher");
  });

  it("matches additional property addresses in search", () => {
    const row = client({
      name: "Hal Fisher",
      address: "3935 Leinbach Dr",
      properties: [
        { id: "p1", label: "Shop", line: "450 N Spring St" },
      ],
    });
    assert.equal(matchesClientQuery(row, "spring"), true);
    assert.equal(matchesClientQuery(row, "shop"), true);
  });
});
