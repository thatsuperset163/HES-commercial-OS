import { ApiError, jsonBody, ok, routeError, salesContext } from "@/lib/sales/http";
import { IntakeRepo } from "@/lib/requestsCenter/repo";
import {
  DECLINE_REASONS,
  INTAKE_STATUSES,
  WAITING_REASONS,
  type IntakeStatus,
} from "@/lib/requestsCenter/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = await salesContext(request);
    const repo = new IntakeRepo(db);
    const detail = await repo.get(id);
    return ok(detail);
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = await salesContext(request);
    const body = (await jsonBody(request)) as Record<string, unknown>;
    const repo = new IntakeRepo(db);

    if (body.status !== undefined) {
      if (!INTAKE_STATUSES.includes(body.status as IntakeStatus)) {
        throw new ApiError(400, "validation_error", "Invalid status");
      }
    }
    if (
      body.waitingReason !== undefined &&
      body.waitingReason &&
      !WAITING_REASONS.includes(body.waitingReason as never)
    ) {
      // allow free text "Other" notes path — still accept listed + custom
    }
    if (
      body.declineReason !== undefined &&
      body.declineReason &&
      !DECLINE_REASONS.includes(body.declineReason as never) &&
      body.declineReason !== ""
    ) {
      // allow listed reasons primarily
    }

    const patch: Record<string, unknown> = {};
    const map: Record<string, string> = {
      status: "status",
      customerName: "customerName",
      company: "company",
      phone: "phone",
      email: "email",
      address: "address",
      serviceRequested: "serviceRequested",
      requestSource: "requestSource",
      priority: "priority",
      notes: "notes",
      dateReceived: "dateReceived",
      estimateDate: "estimateDate",
      estimateTime: "estimateTime",
      assignedPerson: "assignedPerson",
      directions: "directions",
      estimateNotes: "estimateNotes",
      waitingReason: "waitingReason",
      declineReason: "declineReason",
      declineNotes: "declineNotes",
      internalNotes: "internalNotes",
      attachments: "attachments",
      photos: "photos",
      followUpDate: "followUpDate",
      followUpType: "followUpType",
      followUpNotes: "followUpNotes",
      potentialValue: "potentialValue",
      propertyType: "propertyType",
      siteVisitOutcome: "siteVisitOutcome",
      linkedClientId: "linkedClientId",
      convertedQuoteId: "convertedQuoteId",
    };
    for (const [key, target] of Object.entries(map)) {
      if (body[key] !== undefined) patch[target] = body[key];
    }

    const updated = await repo.update(id, patch as never);

    if (body.activityType || body.activityBody) {
      await repo.addActivity(
        id,
        String(body.activityType || "note"),
        String(body.activityBody || body.internalNotes || "Updated"),
      );
    }

    return ok({ request: updated });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = await salesContext(request);
    const repo = new IntakeRepo(db);
    await repo.archive(id);
    return ok({ archived: true });
  } catch (error) {
    return routeError(error);
  }
}
