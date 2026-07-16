import { jsonBody, ok, routeError, salesContext } from "@/lib/sales/http";
import { OpportunitiesRepository } from "@/lib/sales/opportunities";
import { opportunityPayload } from "@/lib/sales/payloads";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    return ok(await new OpportunitiesRepository(await salesContext(request)).get((await context.params).id));
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    return ok(
      await new OpportunitiesRepository(await salesContext(request)).update(
        (await context.params).id,
        opportunityPayload(await jsonBody(request), true),
      ),
    );
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    return ok(await new OpportunitiesRepository(await salesContext(request)).archive((await context.params).id));
  } catch (error) {
    return routeError(error);
  }
}
