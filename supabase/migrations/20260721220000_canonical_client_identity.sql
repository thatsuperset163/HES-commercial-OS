-- Canonical Work client identity is enforced in the blackboard JSON app layer.
-- WorkClient records live in blackboard_workspace.state.clients (not a SQL table).
-- This migration documents the contract and adds no destructive SQL changes.
--
-- Relationship fields (app layer):
--   QuoteDoc.clientId, InvoiceDoc.clientId, ServiceRequest.clientId,
--   WorkTask.clientId, ExpenseDoc.clientId, Job.customerId (= clientId),
--   IntakeRequest.linked_client_id / converted_client_id (already present).
--
-- Backfill / ambiguous flags run in sanitizeClientIntegrity + API PUT.
-- Never auto-create Clients during backfill. Never guess among multiple matches.

comment on column public.intake_requests.linked_client_id is
  'Stable WorkClient id (blackboard). Prefer over name matching.';
comment on column public.intake_requests.converted_client_id is
  'Stable WorkClient id set when request converts to job/invoice.';
comment on column public.field_jobs.customer_id is
  'Stable WorkClient id (canonical clientId for Jobs OS).';
