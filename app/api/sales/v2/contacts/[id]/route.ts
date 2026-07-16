import { ContactsRepository } from "@/lib/sales/contacts";
import { jsonBody, ok, routeError, salesContext } from "@/lib/sales/http";
import { contactPayload } from "@/lib/sales/payloads";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    return ok(
      await new ContactsRepository(await salesContext(request)).update(
        (await context.params).id,
        contactPayload(await jsonBody(request), true),
      ),
    );
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    return ok(await new ContactsRepository(await salesContext(request)).archive((await context.params).id));
  } catch (error) {
    return routeError(error);
  }
}
