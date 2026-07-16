import { jsonBody, ok, routeError, salesContext } from "@/lib/sales/http";
import { OpportunitiesRepository } from "@/lib/sales/opportunities";
import { opportunityPayload } from "@/lib/sales/payloads";
import type { OpportunityInput } from "@/lib/sales/types";

export async function GET(request: Request) {
  try {
    return ok(await new OpportunitiesRepository(await salesContext(request)).list(new URL(request.url).searchParams));
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    return ok(
      await new OpportunitiesRepository(await salesContext(request)).create(
        opportunityPayload(await jsonBody(request)) as OpportunityInput,
      ),
      201,
    );
  } catch (error) {
    return routeError(error);
  }
}
