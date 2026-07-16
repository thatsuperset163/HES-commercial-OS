import { ok, routeError, salesContext } from "@/lib/sales/http";
import { ReferenceRepository } from "@/lib/sales/reference";

export async function GET(request: Request) {
  try {
    return ok(await new ReferenceRepository(await salesContext(request)).all());
  } catch (error) {
    return routeError(error);
  }
}
