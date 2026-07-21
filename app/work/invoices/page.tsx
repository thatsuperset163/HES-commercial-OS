import { Suspense } from "react";
import InvoicesApp from "@/app/InvoicesApp";

export default function Page() {
  return (
    <Suspense fallback={<p className="hq-lede">Loading invoices…</p>}>
      <InvoicesApp />
    </Suspense>
  );
}
