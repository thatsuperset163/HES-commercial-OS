import { CompaniesRepository } from "@/lib/sales/companies";
import { jsonBody, ok, routeError, salesContext } from "@/lib/sales/http";
import { companyPayload } from "@/lib/sales/payloads";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return ok(await new CompaniesRepository(await salesContext(request)).list(url.searchParams));
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const repository = new CompaniesRepository(await salesContext(request));
    return ok(await repository.create(companyPayload(await jsonBody(request)) as Parameters<typeof repository.create>[0]), 201);
  } catch (error) {
    return routeError(error);
  }
}
