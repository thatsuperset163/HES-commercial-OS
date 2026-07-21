import { Suspense } from "react";
import QuotesApp from "@/app/QuotesApp";

export default function Page() {
  return (
    <Suspense fallback={<p className="hq-lede">Loading quotes…</p>}>
      <QuotesApp />
    </Suspense>
  );
}
