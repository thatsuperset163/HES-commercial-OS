import "server-only";

import { NextResponse } from "next/server";
import { AUTH_COOKIE, verifyToken } from "@/lib/auth";
import { getSupabaseServiceRole } from "@/lib/supabase";
import { ValidationError } from "./validation";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function cookie(request: Request, name: string): string | undefined {
  const raw = request.headers.get("cookie");
  return raw
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([key]) => key === name)
    ?.slice(1)
    .join("=");
}

export async function salesContext(request: Request) {
  if (!(await verifyToken(cookie(request, AUTH_COOKIE)))) {
    throw new ApiError(401, "unauthorized", "Authentication required");
  }
  const supabase = getSupabaseServiceRole();
  if (!supabase) {
    throw new ApiError(
      503,
      "service_role_not_configured",
      "Normalized sales APIs require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return supabase;
}

export async function jsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Request body is not valid JSON");
  }
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function routeError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { ok: false, error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }
  if (error instanceof ValidationError) {
    return NextResponse.json(
      { ok: false, error: { code: "validation_error", message: error.message, details: error.details } },
      { status: 400 },
    );
  }
  const candidate = error as { code?: string; message?: string };
  if (candidate?.code === "PGRST116") {
    return NextResponse.json(
      { ok: false, error: { code: "not_found", message: "Resource not found" } },
      { status: 404 },
    );
  }
  if (candidate?.code === "23505") {
    return NextResponse.json(
      { ok: false, error: { code: "conflict", message: candidate.message || "Resource already exists" } },
      { status: 409 },
    );
  }
  if (candidate?.code === "23503" || candidate?.code === "23514") {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_relationship", message: candidate.message || "Related resource is invalid" } },
      { status: 422 },
    );
  }
  console.error("Sales API error", error);
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "internal_error",
        message: candidate?.message || "Unexpected server error",
      },
    },
    { status: 500 },
  );
}

export function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function assertData<T>(
  result: { data: T | null; error: unknown },
  notFound = false,
): T {
  if (result.error) throw result.error;
  if (notFound && result.data === null) {
    throw new ApiError(404, "not_found", "Resource not found");
  }
  return result.data as T;
}
