import { ApiError, ok, routeError, salesContext } from "@/lib/sales/http";
import { createJob, normalizeJobs } from "@/lib/jobs/model";
import { IntakeRepo } from "@/lib/requestsCenter/repo";
import {
  createClient,
  createInvoice,
  createTask,
  normalizeClients,
  normalizeExpenses,
  normalizeInvoices,
  normalizeQuotes,
  normalizeRequests,
  normalizeTasks,
} from "@/lib/work/model";

type Params = { params: Promise<{ id: string }> };

type BlackboardState = {
  days?: Record<string, unknown>;
  jobs?: unknown[];
  clients?: unknown[];
  requests?: unknown[];
  tasks?: unknown[];
  quotes?: unknown[];
  invoices?: unknown[];
  expenses?: unknown[];
  ideaLot?: string;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = await salesContext(request);
    const repo = new IntakeRepo(db);
    const { request: intake } = await repo.get(id);

    if (intake.status === "declined") {
      throw new ApiError(400, "invalid_state", "Declined requests cannot convert to jobs");
    }

    const client = createClient({
      name: intake.company || intake.customerName,
      phone: intake.phone,
      email: intake.email,
      address: intake.address,
      notes: `From Requests Center ${intake.id}`,
    });

    const jobDate = intake.estimateDate || intake.dateReceived;
    const job = createJob({
      customerName: intake.customerName,
      address: intake.address,
      service: intake.serviceRequested,
      scheduledDate: jobDate,
      amount: null,
      notes: [
        intake.estimateTime ? `Estimate/time: ${intake.estimateTime}` : "",
        intake.assignedPerson ? `Assigned: ${intake.assignedPerson}` : "",
        intake.directions ? `Directions: ${intake.directions}` : "",
        intake.notes,
        `Converted from request ${intake.id}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    const invoice = createInvoice({
      clientName: intake.customerName,
      jobLabel: intake.serviceRequested,
      amount: null,
      dueDate: jobDate,
      notes: `Draft invoice for job ${job.id} (from request ${intake.id})`,
    });

    const calendarTask = createTask({
      title: `Job / calendar: ${intake.customerName} — ${intake.serviceRequested}`,
      dueDate: jobDate,
      notes: [
        intake.estimateTime ? `Time: ${intake.estimateTime}` : "",
        intake.address,
        `Job ${job.id}`,
      ]
        .filter(Boolean)
        .join(" · "),
    });

    const { data, error } = await db
      .from("blackboard_workspace")
      .select("state")
      .eq("id", "default")
      .maybeSingle();
    if (error) throw error;

    const state = (data?.state ?? { days: {} }) as BlackboardState;
    const nextState: BlackboardState = {
      ...state,
      days: state.days && typeof state.days === "object" ? state.days : {},
      clients: [client, ...normalizeClients(state.clients)],
      jobs: [job, ...normalizeJobs(state.jobs)],
      invoices: [invoice, ...normalizeInvoices(state.invoices)],
      tasks: [calendarTask, ...normalizeTasks(state.tasks)],
      requests: normalizeRequests(state.requests),
      quotes: normalizeQuotes(state.quotes),
      expenses: normalizeExpenses(state.expenses),
      ideaLot: state.ideaLot ?? "",
    };

    const updatedAt = new Date().toISOString();
    const { error: saveError } = await db.from("blackboard_workspace").upsert({
      id: "default",
      state: nextState,
      updated_at: updatedAt,
    });
    if (saveError) throw saveError;

    const updated = await repo.update(id, {
      status: "approved",
      convertedClientId: client.id,
      convertedJobId: job.id,
      convertedInvoiceId: invoice.id,
    });
    await repo.addActivity(
      id,
      "converted",
      `Converted to client ${client.id}, job ${job.id}, invoice ${invoice.id}, calendar task ${calendarTask.id}`,
      {
        clientId: client.id,
        jobId: job.id,
        invoiceId: invoice.id,
        taskId: calendarTask.id,
      },
    );

    return ok({
      request: updated,
      client,
      job,
      invoice,
      calendarTask,
    });
  } catch (error) {
    return routeError(error);
  }
}
