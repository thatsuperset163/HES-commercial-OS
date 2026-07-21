import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HES_QUOTE_INTRO,
  HES_QUOTE_TERMS,
  formatQuoteDate,
  formatQuoteMoney,
} from "../lib/quotes/template.ts";

describe("HES quote template", () => {
  it("includes the official intro and terms from the Word template", () => {
    assert.match(HES_QUOTE_INTRO, /Harris Exterior Solutions/);
    assert.ok(HES_QUOTE_TERMS.length >= 6);
    assert.match(HES_QUOTE_TERMS[0]!, /licensed and insured/i);
    assert.match(HES_QUOTE_TERMS.join(" "), /water spigot/i);
  });

  it("formats money and dates for the document", () => {
    assert.equal(formatQuoteMoney(1250), "$1,250");
    assert.equal(formatQuoteMoney(null), "TBD");
    assert.match(formatQuoteDate("2026-07-21"), /2026/);
  });
});
