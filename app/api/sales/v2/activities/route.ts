import { ActivitiesRepository } from "@/lib/sales/activities";
import { jsonBody, ok, routeError, salesContext } from "@/lib/sales/http";
import { activityPayload } from "@/lib/sales/payloads";

export async function GET(request: Request) {
  try {
    return ok(await new ActivitiesRepository(await salesContext(request)).list(new URL(request.url).searchParams));
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    return ok(
      await new ActivitiesRepository(await salesContext(request)).create(activityPayload(await jsonBody(request))),
      201,
    );
  } catch (error) {
    return routeError(error);
  }
}
