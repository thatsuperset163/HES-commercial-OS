import { ApiError, jsonBody, ok, routeError, salesContext } from "@/lib/sales/http";
import { addMinutesToTime } from "@/lib/jobs/model";
import { FieldJobsRepo } from "@/lib/jobs/repo";
import type { Job, JobStatus } from "@/lib/jobs/types";
import { JOB_STATUSES } from "@/lib/jobs/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const db = await salesContext(request);
    const { id } = await context.params;
    const job = await new FieldJobsRepo(db).get(id);
    return ok({ job });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    const db = await salesContext(request);
    const { id } = await context.params;
    const body = (await jsonBody(request)) as Record<string, unknown>;
    const repo = new FieldJobsRepo(db);

    if (body.action === "reschedule") {
      const scheduledDate = String(body.scheduledDate || "");
      const startTime = String(body.startTime || "09:00");
      const duration = Number(body.estimatedDurationMinutes);
      const endTime =
        String(body.endTime || "") ||
        (Number.isFinite(duration)
          ? addMinutesToTime(startTime, duration)
          : undefined);
      const job = await repo.reschedule(id, scheduledDate, startTime, endTime);
      return ok({ job });
    }

    const patch: Partial<Job> = {};
    const strKeys = [
      "customerName",
      "companyName",
      "contactName",
      "phone",
      "email",
      "address",
      "service",
      "title",
      "description",
      "scheduledDate",
      "startTime",
      "endTime",
      "assignedTo",
      "notes",
      "customerNotes",
      "equipmentNeeded",
      "recurringRule",
      "customerId",
      "requestId",
      "prospectId",
    ] as const;

    for (const key of strKeys) {
      if (body[key] !== undefined) {
        (patch as Record<string, unknown>)[key] = String(body[key] ?? "");
      }
    }

    if (body.estimatedDurationMinutes !== undefined) {
      patch.estimatedDurationMinutes = Math.max(
        15,
        Number(body.estimatedDurationMinutes) || 15,
      );
    }
    if (body.amount !== undefined) {
      patch.amount =
        body.amount === null || body.amount === ""
          ? null
          : Number(body.amount);
      if (patch.amount !== null && !Number.isFinite(patch.amount)) {
        throw new ApiError(400, "validation_error", "Amount must be a number");
      }
    }
    if (body.status !== undefined) {
      if (!JOB_STATUSES.some((row) => row.id === body.status)) {
        throw new ApiError(400, "validation_error", "Invalid job status");
      }
      patch.status = body.status as JobStatus;
    }
    if (body.priority !== undefined) {
      patch.priority = body.priority as Job["priority"];
    }
    if (body.invoiceStatus !== undefined) {
      patch.invoiceStatus = body.invoiceStatus as Job["invoiceStatus"];
    }
    if (body.paymentStatus !== undefined) {
      patch.paymentStatus = body.paymentStatus as Job["paymentStatus"];
    }

    if (!Object.keys(patch).length) {
      throw new ApiError(400, "validation_error", "No fields to update");
    }

    const job = await repo.update(id, patch);
    return ok({ job });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: Ctx) {
  try {
    const db = await salesContext(request);
    const { id } = await context.params;
    await new FieldJobsRepo(db).archive(id);
    return ok({ id });
  } catch (error) {
    return routeError(error);
  }
}
