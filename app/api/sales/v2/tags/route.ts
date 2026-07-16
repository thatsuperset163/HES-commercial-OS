import { jsonBody, ok, routeError, salesContext } from "@/lib/sales/http";
import { tagPayload } from "@/lib/sales/payloads";
import { TagsRepository } from "@/lib/sales/tags";

export async function GET(request: Request) {
  try {
    return ok(await new TagsRepository(await salesContext(request)).list(new URL(request.url).searchParams));
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    return ok(await new TagsRepository(await salesContext(request)).create(tagPayload(await jsonBody(request))), 201);
  } catch (error) {
    return routeError(error);
  }
}
