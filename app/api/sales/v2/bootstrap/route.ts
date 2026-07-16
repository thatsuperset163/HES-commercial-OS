import { BootstrapRepository } from "@/lib/sales/bootstrap";
import { ok, routeError, salesContext } from "@/lib/sales/http";

export async function GET(request: Request) {
  try {
    return ok(await new BootstrapRepository(await salesContext(request)).load());
  } catch (error) {
    return routeError(error);
  }
}
