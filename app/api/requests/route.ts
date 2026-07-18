import { ApiError, jsonBody, ok, routeError, salesContext } from "@/lib/sales/http";
import { buildDashboard } from "@/lib/requestsCenter/model";
import { runIntakeEstimateNags } from "@/lib/requestsCenter/nags";
import { IntakeRepo } from "@/lib/requestsCenter/repo";
import { INTAKE_STATUSES, type IntakeStatus } from "@/lib/requestsCenter/types";

export async function GET(request: Request) {
  try {
    const db = await salesContext(request);
    const repo = new IntakeRepo(db);
    const rows = await repo.list();
    await runIntakeEstimateNags(db, rows);
    return ok({ requests: rows, dashboard: buildDashboard(rows) });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const db = await salesContext(request);
    const body = (await jsonBody(request)) as Record<string, unknown>;
    const customerName = String(body.customerName || "").trim();
    if (!customerName) {
      throw new ApiError(400, "validation_error", "Customer name is required");
    }
    const phone = String(body.phone || "").trim();
    const email = String(body.email || "").trim();
    if (!phone && !email) {
      throw new ApiError(400, "validation_error", "Phone or email is required");
    }

    const status = INTAKE_STATUSES.includes(body.status as IntakeStatus)
      ? (body.status as IntakeStatus)
      : "new";

    const repo = new IntakeRepo(db);
    const created = await repo.create({
      customerName,
      company: String(body.company || ""),
      phone,
      email,
      address: String(body.address || ""),
      serviceRequested: String(body.serviceRequested || ""),
      requestSource: body.requestSource as never,
      priority: body.priority as never,
      notes: String(body.notes || ""),
      dateReceived: String(body.dateReceived || ""),
      status,
    });

    return ok({ request: created }, 201);
  } catch (error) {
    return routeError(error);
  }
}
