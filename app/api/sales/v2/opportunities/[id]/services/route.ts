import { jsonBody, ok, routeError, salesContext } from "@/lib/sales/http";
import { OpportunitiesRepository } from "@/lib/sales/opportunities";
import { objectBody, ValidationError } from "@/lib/sales/validation";

type Context = { params: Promise<{ id: string }> };

function parseServiceIds(body: unknown): string[] {
  const payload = objectBody(body);
  const value = payload.service_ids ?? payload.serviceIds;
  if (!Array.isArray(value)) {
    throw new ValidationError("service_ids must be an array of service ids");
  }
  return value.map((item, index) => {
    if (typeof item !== "string" || !item.trim()) {
      throw new ValidationError(`service_ids[${index}] must be a non-empty string`);
    }
    return item.trim();
  });
}

export async function PUT(request: Request, context: Context) {
  try {
    const opportunityId = (await context.params).id;
    const serviceIds = parseServiceIds(await jsonBody(request));
    return ok(
      await new OpportunitiesRepository(await salesContext(request)).replaceServices(
        opportunityId,
        serviceIds,
      ),
    );
  } catch (error) {
    return routeError(error);
  }
}
