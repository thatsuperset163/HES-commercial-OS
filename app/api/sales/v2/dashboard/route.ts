import { DashboardRepository } from "@/lib/sales/dashboard";
import { ok, routeError, salesContext } from "@/lib/sales/http";

export async function GET(request: Request) {
  try {
    return ok(await new DashboardRepository(await salesContext(request)).summary());
  } catch (error) {
    return routeError(error);
  }
}
