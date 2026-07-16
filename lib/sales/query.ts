import type { PageOptions } from "./types.ts";
import { ValidationError } from "./validation.ts";

export function parsePage(
  params: URLSearchParams,
  allowedSorts: readonly string[],
  defaultSort = "created_at",
): PageOptions {
  const page = integer(params.get("page"), "page", 1, 1, 1_000_000);
  const pageSize = integer(params.get("pageSize"), "pageSize", 25, 1, 100);
  const sort = params.get("sort") || defaultSort;
  if (!allowedSorts.includes(sort)) {
    throw new ValidationError(`sort must be one of: ${allowedSorts.join(", ")}`);
  }
  const direction = params.get("direction") || "desc";
  if (direction !== "asc" && direction !== "desc") {
    throw new ValidationError("direction must be asc or desc");
  }
  return { page, pageSize, sort, direction };
}

export function integer(
  value: string | null,
  field: string,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new ValidationError(`${field} must be an integer from ${min} to ${max}`);
  }
  return parsed;
}

export function optionalQueryNumber(
  params: URLSearchParams,
  field: string,
): number | undefined {
  const raw = params.get(field);
  if (raw === null || raw === "") return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new ValidationError(`${field} must be a non-negative number`);
  }
  return value;
}

export function optionalQueryDate(
  params: URLSearchParams,
  field: string,
): string | undefined {
  const raw = params.get(field);
  if (!raw) return undefined;
  if (!Number.isFinite(Date.parse(raw))) {
    throw new ValidationError(`${field} must be a valid date`);
  }
  return new Date(raw).toISOString();
}

export function pageRange(page: PageOptions): [number, number] {
  const from = (page.page - 1) * page.pageSize;
  return [from, from + page.pageSize - 1];
}

export function pageResult<T>(
  data: T[] | null,
  count: number | null,
  page: PageOptions,
) {
  const total = count ?? 0;
  return {
    data: data ?? [],
    page: page.page,
    pageSize: page.pageSize,
    total,
    totalPages: Math.ceil(total / page.pageSize),
  };
}
