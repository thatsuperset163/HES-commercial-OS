import { CompaniesRepository } from "@/lib/sales/companies";
import { jsonBody, ok, routeError, salesContext } from "@/lib/sales/http";
import { companyPayload } from "@/lib/sales/payloads";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    return ok(await new CompaniesRepository(await salesContext(request)).get((await context.params).id));
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const repository = new CompaniesRepository(await salesContext(request));
    return ok(await repository.update((await context.params).id, companyPayload(await jsonBody(request), true)));
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    return ok(await new CompaniesRepository(await salesContext(request)).archive((await context.params).id));
  } catch (error) {
    return routeError(error);
  }
}
