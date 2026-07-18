import { jsonBody, ok, routeError, salesContext } from "@/lib/sales/http";
import { IntakeRepo } from "@/lib/requestsCenter/repo";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = await salesContext(request);
    const body = (await jsonBody(request)) as {
      activityType?: string;
      body?: string;
      meta?: Record<string, unknown>;
    };
    const repo = new IntakeRepo(db);
    const activity = await repo.addActivity(
      id,
      body.activityType || "note",
      body.body || "",
      body.meta || {},
    );
    // bump parent updated_at
    await repo.update(id, {});
    return ok({ activity }, 201);
  } catch (error) {
    return routeError(error);
  }
}
