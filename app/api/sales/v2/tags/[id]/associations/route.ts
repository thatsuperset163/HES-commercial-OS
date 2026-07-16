import { ApiError, jsonBody, ok, routeError, salesContext } from "@/lib/sales/http";
import { TagsRepository } from "@/lib/sales/tags";
import { objectBody, requiredString } from "@/lib/sales/validation";

type Context = { params: Promise<{ id: string }> };

async function values(request: Request) {
  const body = objectBody(await jsonBody(request));
  return {
    entityType: requiredString(body.entityType, "entityType", 30),
    entityId: requiredString(body.entityId, "entityId", 200),
  };
}

export async function POST(request: Request, context: Context) {
  try {
    const body = await values(request);
    return ok(
      await new TagsRepository(await salesContext(request)).associate(
        (await context.params).id,
        body.entityType,
        body.entityId,
      ),
      201,
    );
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const url = new URL(request.url);
    const entityType = url.searchParams.get("entityType");
    const entityId = url.searchParams.get("entityId");
    if (!entityType || !entityId) {
      throw new ApiError(400, "validation_error", "entityType and entityId are required");
    }
    return ok(
      await new TagsRepository(await salesContext(request)).dissociate(
        (await context.params).id,
        entityType,
        entityId,
      ),
    );
  } catch (error) {
    return routeError(error);
  }
}
