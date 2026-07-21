import { Suspense } from "react";
import RequestsCenterApp from "@/app/RequestsCenterApp";

export default function WorkRequestsPage() {
  return (
    <Suspense fallback={<p className="hq-lede">Loading requests…</p>}>
      <RequestsCenterApp />
    </Suspense>
  );
}
