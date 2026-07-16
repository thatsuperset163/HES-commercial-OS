import { jsonBody, ok, routeError, salesContext } from "@/lib/sales/http";
import { taskPayload } from "@/lib/sales/payloads";
import { TasksRepository } from "@/lib/sales/tasks";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    return ok(
      await new TasksRepository(await salesContext(request)).update(
        (await context.params).id,
        taskPayload(await jsonBody(request), true),
      ),
    );
  } catch (error) {
    return routeError(error);
  }
}
