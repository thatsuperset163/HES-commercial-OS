-- Client uniqueness for blackboard-backed Work Clients.
--
-- Work clients live inside blackboard_workspace.state.clients (JSONB array),
-- not a relational clients table. Postgres cannot place a practical UNIQUE
-- constraint on nested JSON array object fields without a breaking extract.
--
-- Uniqueness is enforced in application code:
--   * lib/clients/identity.ts (match + dedupe)
--   * lib/work/model.ts findOrCreateClient
--   * lib/storage.ts sanitizeClientIntegrity on load/save/hydrate
--   * app/api/blackboard/state PUT sanitizes before upsert
--   * request convert reuses existing clients and refuses re-convert
--
-- This migration is intentionally a no-op schema change so deploys stay safe
-- while documenting the integrity contract: one real-world client = one record.

do $$
begin
  raise notice 'HES: client uniqueness enforced in app layer (blackboard JSON clients)';
end $$;
