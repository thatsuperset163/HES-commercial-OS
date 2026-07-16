import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertData, id } from "./http";
import type { ContactInput } from "./types";

export class ContactsRepository {
  constructor(private readonly db: SupabaseClient) {}

  async create(input: ContactInput) {
    if (input.is_primary) await this.clearPrimary(input.company_id);
    return assertData(
      await this.db.from("contacts").insert({ id: id("contact"), ...input }).select("*").single(),
    );
  }

  async update(contactId: string, input: Partial<ContactInput>) {
    if (input.is_primary) {
      const current = assertData<{ company_id: string }>(
        await this.db.from("contacts").select("company_id").eq("id", contactId).is("archived_at", null).maybeSingle(),
        true,
      );
      await this.clearPrimary(input.company_id ?? current.company_id);
    }
    return assertData(
      await this.db
        .from("contacts")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", contactId)
        .is("archived_at", null)
        .select("*")
        .single(),
    );
  }

  async archive(contactId: string) {
    const now = new Date().toISOString();
    return assertData(
      await this.db.from("contacts").update({ archived_at: now, updated_at: now }).eq("id", contactId).is("archived_at", null).select("*").single(),
    );
  }

  private async clearPrimary(companyId: string) {
    const result = await this.db
      .from("contacts")
      .update({ is_primary: false, updated_at: new Date().toISOString() })
      .eq("company_id", companyId)
      .eq("is_primary", true)
      .is("archived_at", null);
    if (result.error) throw result.error;
  }
}
