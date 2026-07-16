export class ValidationError extends Error {
  readonly status = 400;
  readonly details?: Record<string, string>;
  constructor(
    message: string,
    details?: Record<string, string>,
  ) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}

type Shape = Record<string, unknown>;

export function objectBody(value: unknown): Shape {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("Request body must be a JSON object");
  }
  return value as Shape;
}

export function pick(
  value: unknown,
  allowed: readonly string[],
): Shape {
  const source = objectBody(value);
  const output: Shape = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(source, key)) output[key] = source[key];
  }
  return output;
}

export function requiredString(
  value: unknown,
  field: string,
  max = 500,
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`${field} is required`, { [field]: "Required" });
  }
  const normalized = value.trim();
  if (normalized.length > max) {
    throw new ValidationError(`${field} is too long`, {
      [field]: `Maximum length is ${max}`,
    });
  }
  return normalized;
}

export function optionalString(
  value: unknown,
  field: string,
  max = 5000,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new ValidationError(`${field} must be a string or null`);
  }
  const normalized = value.trim();
  if (normalized.length > max) {
    throw new ValidationError(`${field} is too long`);
  }
  return normalized || null;
}

export function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new ValidationError(`${field} must be a boolean`);
  }
  return value;
}

export function optionalNumber(
  value: unknown,
  field: string,
): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new ValidationError(`${field} must be a non-negative number or null`);
  }
  return value;
}

export function optionalDate(
  value: unknown,
  field: string,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new ValidationError(`${field} must be an ISO date or null`);
  }
  return new Date(value).toISOString();
}

export function optionalEnum<T extends string>(
  value: unknown,
  field: string,
  values: readonly T[],
): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new ValidationError(`${field} must be one of: ${values.join(", ")}`);
  }
  return value as T;
}

export function optionalJsonObject(
  value: unknown,
  field: string,
): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}
