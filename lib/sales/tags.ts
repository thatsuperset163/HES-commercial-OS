import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, assertData, id } from "./http";
import { pageRange, pageResult, parsePage } from "./query";
import type { TagInput } from "./types";

const ASSOCIATIONS = {
  company: { table: "company_tags", key: "company_id" },
  contact: { table: "contact_tags", key: "contact_id" },
  opportunity: { table: "opportunity_tags", key: "opportunity_id" },
} as const;

export class TagsRepository {
  constructor(private readonly db: SupabaseClient) {}

  async list(params: URLSearchParams) {
    const page = parsePage(params, ["name", "created_at", "updated_at"], "name");
    const [from, to] = pageRange(page);
    const result = await this.db
      .from("tags")
      .select("*", { count: "exact" })
      .is("archived_at", null)
      .order(page.sort, { ascending: page.direction === "asc" })
      .order("id", { ascending: true })
      .range(from, to);
    if (result.error) throw result.error;
    return pageResult(result.data, result.count, page);
  }

  async create(input: TagInput) {
    return assertData(
      await this.db.from("tags").insert({ id: id("tag"), ...input }).select("*").single(),
    );
  }

  async associate(tagId: string, entityType: string, entityId: string) {
    const association = ASSOCIATIONS[entityType as keyof typeof ASSOCIATIONS];
    if (!association) throw new ApiError(400, "validation_error", "entityType must be company, contact, or opportunity");
    return assertData(
      await this.db.from(association.table).upsert({ tag_id: tagId, [association.key]: entityId }, { onConflict: `${association.key},tag_id` }).select("*").single(),
    );
  }

  async dissociate(tagId: string, entityType: string, entityId: string) {
    const association = ASSOCIATIONS[entityType as keyof typeof ASSOCIATIONS];
    if (!association) throw new ApiError(400, "validation_error", "entityType must be company, contact, or opportunity");
    const result = await this.db.from(association.table).delete().eq("tag_id", tagId).eq(association.key, entityId);
    if (result.error) throw result.error;
    return { tag_id: tagId, entityType, entityId };
  }
}
