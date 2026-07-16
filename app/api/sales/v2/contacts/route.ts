import { ContactsRepository } from "@/lib/sales/contacts";
import { jsonBody, ok, routeError, salesContext } from "@/lib/sales/http";
import { contactPayload } from "@/lib/sales/payloads";
import type { ContactInput } from "@/lib/sales/types";

export async function POST(request: Request) {
  try {
    return ok(
      await new ContactsRepository(await salesContext(request)).create(
        contactPayload(await jsonBody(request)) as ContactInput,
      ),
      201,
    );
  } catch (error) {
    return routeError(error);
  }
}
