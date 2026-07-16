import { jsonBody, ok, routeError, salesContext } from "@/lib/sales/http";
import { taskPayload } from "@/lib/sales/payloads";
import { TasksRepository } from "@/lib/sales/tasks";
import type { TaskInput } from "@/lib/sales/types";

export async function GET(request: Request) {
  try {
    return ok(await new TasksRepository(await salesContext(request)).list(new URL(request.url).searchParams));
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    return ok(
      await new TasksRepository(await salesContext(request)).create(
        taskPayload(await jsonBody(request)) as TaskInput,
      ),
      201,
    );
  } catch (error) {
    return routeError(error);
  }
}
