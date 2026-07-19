import { ApiError, jsonBody, ok, routeError, salesContext } from "@/lib/sales/http";
import { createJob, normalizeJobRecord } from "@/lib/jobs/model";
import { FieldJobsRepo } from "@/lib/jobs/repo";
import type { JobInput, JobStatus } from "@/lib/jobs/types";
import { JOB_STATUSES } from "@/lib/jobs/types";

export async function GET(request: Request) {
  try {
    const db = await salesContext(request);
    const repo = new FieldJobsRepo(db);
    const jobs = await repo.list();
    return ok({ jobs });
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

    const status = JOB_STATUSES.some((row) => row.id === body.status)
      ? (body.status as JobStatus)
      : undefined;

    const input: JobInput = {
      customerName,
      companyName: String(body.companyName || ""),
      contactName: String(body.contactName || ""),
      phone: String(body.phone || ""),
      email: String(body.email || ""),
      address: String(body.address || ""),
      service: String(body.service || ""),
      title: String(body.title || ""),
      description: String(body.description || ""),
      scheduledDate: String(body.scheduledDate || ""),
      startTime: String(body.startTime || ""),
      endTime: String(body.endTime || ""),
      estimatedDurationMinutes:
        body.estimatedDurationMinutes == null
          ? undefined
          : Number(body.estimatedDurationMinutes),
      amount:
        body.amount === undefined || body.amount === null || body.amount === ""
          ? null
          : Number(body.amount),
      assignedTo: String(body.assignedTo || ""),
      status,
      priority: body.priority as JobInput["priority"],
      notes: String(body.notes || ""),
      customerNotes: String(body.customerNotes || ""),
      equipmentNeeded: String(body.equipmentNeeded || ""),
      customerId: body.customerId ? String(body.customerId) : null,
      requestId: body.requestId ? String(body.requestId) : null,
      prospectId: body.prospectId ? String(body.prospectId) : null,
      invoiceStatus: body.invoiceStatus as JobInput["invoiceStatus"],
      paymentStatus: body.paymentStatus as JobInput["paymentStatus"],
      recurringRule: String(body.recurringRule || ""),
    };

    // Validate shape before insert (also catches NaN amounts)
    const preview = createJob(input);
    if (
      input.amount !== undefined &&
      input.amount !== null &&
      !Number.isFinite(Number(input.amount))
    ) {
      throw new ApiError(400, "validation_error", "Amount must be a number");
    }

    const repo = new FieldJobsRepo(db);
    if (body.id) {
      const withId = normalizeJobRecord({
        ...preview,
        ...body,
        id: String(body.id),
      });
      const created = await repo.upsert(withId);
      return ok({ job: created }, 201);
    }
    const created = await repo.create(input);
    return ok({ job: created }, 201);
  } catch (error) {
    return routeError(error);
  }
}
