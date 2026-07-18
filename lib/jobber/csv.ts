/** Minimal CSV parser — handles quotes and commas. */

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((line) => line.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };

  const table = lines.map(parseCsvLine);
  const headers = table[0].map((h) => h.trim());
  const rows = table.slice(1).filter((row) => row.some((cell) => cell.trim()));
  return { headers, rows };
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out;
}

export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function rowToObject(
  headers: string[],
  row: string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((header, index) => {
    out[normalizeHeader(header)] = (row[index] ?? "").trim();
  });
  return out;
}

/** Find first matching value among candidate normalized headers (exact keys only). */
export function pickField(
  row: Record<string, string>,
  candidates: string[],
): string {
  for (const key of candidates) {
    const value = row[normalizeHeader(key)];
    if (value) return value;
  }
  return "";
}
