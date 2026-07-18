import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createJob, normalizeJobs } from "../jobs/model";
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
} from "../work/model";
import { IntakeRepo } from "./repo";
import type { IntakeRequest } from "./types";
import type { Job } from "../jobs/types";
import type { InvoiceDoc, WorkClient, WorkTask } from "../work/types";

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

export type ConvertResult = {
  request: IntakeRequest;
  client: WorkClient;
  job: Job;
  invoice: InvoiceDoc;
  calendarTask: WorkTask;
};

export async function convertIntakeToJob(
  db: SupabaseClient,
  id: string,
): Promise<ConvertResult> {
  const repo = new IntakeRepo(db);
  const { request: intake } = await repo.get(id);

  if (intake.status === "declined") {
    throw Object.assign(new Error("Declined requests cannot convert to jobs"), {
      status: 400,
      code: "invalid_state",
    });
  }

  if (intake.convertedJobId) {
    const { request } = await repo.get(id);
    // Already converted — return current linkage without duplicating.
    return {
      request,
      client: createClient({
        name: intake.company || intake.customerName,
        phone: intake.phone,
        email: intake.email,
        address: intake.address,
      }),
      job: createJob({
        customerName: intake.customerName,
        address: intake.address,
        service: intake.serviceRequested,
        scheduledDate: intake.estimateDate || intake.dateReceived,
      }),
      invoice: createInvoice({
        clientName: intake.customerName,
        jobLabel: intake.serviceRequested,
      }),
      calendarTask: createTask({
        title: `Job / calendar: ${intake.customerName}`,
        dueDate: intake.estimateDate || intake.dateReceived,
      }),
    };
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
    notes: `Draft invoice · job:${job.id} · request ${intake.id}`,
  });

  const calendarTask = createTask({
    title: `Job / calendar: ${intake.customerName} — ${intake.serviceRequested}`,
    dueDate: jobDate,
    notes: [
      `auto:converted-request:${intake.id}`,
      intake.estimateTime ? `Time: ${intake.estimateTime}` : "",
      intake.address,
      `Job ${job.id}`,
    ]
      .filter(Boolean)
      .join(" · "),
  });

  const respondTask = createTask({
    title: `Confirm schedule with ${intake.customerName}`,
    dueDate: jobDate,
    notes: `auto:confirm-job:${job.id}`,
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
    tasks: [calendarTask, respondTask, ...normalizeTasks(state.tasks)],
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
    `Auto-converted to client ${client.id}, job ${job.id}, invoice ${invoice.id}`,
    {
      clientId: client.id,
      jobId: job.id,
      invoiceId: invoice.id,
      taskId: calendarTask.id,
    },
  );

  return {
    request: updated,
    client,
    job,
    invoice,
    calendarTask,
  };
}
