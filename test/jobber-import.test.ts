import assert from "node:assert/strict";
import test from "node:test";
import { parseCsv, pickField, rowToObject } from "../lib/jobber/csv.ts";
import {
  importClientsFromCsv,
  importJobsFromCsv,
} from "../lib/jobber/map.ts";

test("parseCsv handles quotes and commas", () => {
  const { headers, rows } = parseCsv(
    'Name,Notes\n"Acme, LLC","Said ""hello"""\nBob,Simple',
  );
  assert.deepEqual(headers, ["Name", "Notes"]);
  assert.equal(rows[0]?.[0], "Acme, LLC");
  assert.equal(rows[0]?.[1], 'Said "hello"');
  assert.equal(rows[1]?.[0], "Bob");
});

test("importClientsFromCsv maps Jobber-like headers", () => {
  const csv = [
    "First Name,Last Name,Company Name,Main Phone,Email,Street,City,State,Postal Code",
    "Amy,Stone,,555-0100,amy@example.com,12 Oak St,Austin,TX,78701",
    ",,Plaza LLC,555-0200,mgr@plaza.com,100 Main,Austin,TX,78702",
  ].join("\n");
  const result = importClientsFromCsv(csv);
  assert.equal(result.clients.length, 2);
  assert.equal(result.clients[0]?.name, "Amy Stone");
  assert.match(result.clients[0]?.address ?? "", /12 Oak St/);
  assert.equal(result.clients[1]?.name, "Plaza LLC");
});

test("importJobsFromCsv creates jobs and companion clients", () => {
  const csv = [
    "Client name,Title,Schedule start date,Service street,Service city,Total revenue ($),Closed date",
    "Bob Jones,House wash,2026-07-10,9 Pine,Austin,350,2026-07-11",
    'Plaza LLC,Storefront,07/18/2026,100 Main,Austin,"$1,200",',
  ].join("\n");
  const result = importJobsFromCsv(csv);
  assert.equal(result.jobs.length, 2);
  assert.equal(result.jobs[0]?.status, "done");
  assert.equal(result.jobs[0]?.amount, 350);
  assert.equal(result.jobs[1]?.status, "scheduled");
  assert.equal(result.jobs[1]?.amount, 1200);
  assert.equal(result.jobs[1]?.scheduledDate, "2026-07-18");
  assert.equal(result.clients.length, 2);
});

test("pickField finds exact normalized headers", () => {
  const row = rowToObject(
    ["Client Phone", "Service Street"],
    ["555-9", "1 Main"],
  );
  assert.equal(pickField(row, ["client phone", "phone"]), "555-9");
  assert.equal(pickField(row, ["service street", "street"]), "1 Main");
});
