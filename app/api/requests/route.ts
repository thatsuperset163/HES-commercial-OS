import { ApiError, jsonBody, ok, routeError, salesContext } from "@/lib/sales/http";
import {
  buildDashboard,
  findRecentDuplicate,
} from "@/lib/requestsCenter/model";
import { IntakeRepo } from "@/lib/requestsCenter/repo";
import { INTAKE_STATUSES, type IntakeStatus } from "@/lib/requestsCenter/types";

export async function GET(request: Request) {
  try {
    const db = await salesContext(request);
    const repo = new IntakeRepo(db);
    const rows = await repo.list();
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

    const force = body.forceCreate === true || body.forceCreate === "true";
    const status = INTAKE_STATUSES.includes(body.status as IntakeStatus)
      ? (body.status as IntakeStatus)
      : "new";

    const repo = new IntakeRepo(db);
    const existing = await repo.list();
    const dup = findRecentDuplicate(existing, { phone, email, customerName });
    if (dup && !force) {
      console.info("[requests] create_blocked_duplicate", {
        existingId: dup.id,
        customerName,
        phone,
        email,
      });
      throw new ApiError(
        409,
        "duplicate_request",
        `A recent request already exists for this contact (${dup.customerName}). Open that request or confirm force create.`,
      );
    }

    console.info("[requests] create_request_start", {
      customerName,
      phone,
      email,
      force,
    });

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
      estimateDate: body.estimateDate ? String(body.estimateDate) : null,
      estimateTime: String(body.estimateTime || ""),
      propertyType: body.propertyType as never,
      potentialValue:
        body.potentialValue === undefined || body.potentialValue === ""
          ? null
          : Number(body.potentialValue),
      linkedClientId: body.linkedClientId
        ? String(body.linkedClientId)
        : null,
    });

    console.info("[requests] created_new", { id: created.id, customerName });
    return ok({ request: created }, 201);
  } catch (error) {
    return routeError(error);
  }
}
