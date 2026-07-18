import { ApiError, ok, routeError, salesContext } from "@/lib/sales/http";
import { convertIntakeToJob } from "@/lib/requestsCenter/convert";
import { IntakeRepo } from "@/lib/requestsCenter/repo";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = await salesContext(request);
    const repo = new IntakeRepo(db);
    const { request: intake } = await repo.get(id);

    if (intake.status === "declined") {
      throw new ApiError(
        400,
        "invalid_state",
        "Declined requests cannot convert to jobs",
      );
    }

    const result = await convertIntakeToJob(db, id);
    return ok(result);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "invalid_state"
    ) {
      const message =
        error instanceof Error ? error.message : "Invalid request state";
      return routeError(new ApiError(400, "invalid_state", message));
    }
    return routeError(error);
  }
}
