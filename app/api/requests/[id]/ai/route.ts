import { ok, routeError, salesContext } from "@/lib/sales/http";
import { IntakeRepo } from "@/lib/requestsCenter/repo";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = await salesContext(request);
    const repo = new IntakeRepo(db);
    const refreshed = await repo.refreshAi(id);
    return ok({ request: refreshed });
  } catch (error) {
    return routeError(error);
  }
}
