import { Suspense } from "react";
import JobsApp from "../../JobsApp";
import AppShell from "../../AppShell";

export default function JobsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <p className="hq-lede">Loading Jobs OS…</p>
        </AppShell>
      }
    >
      <JobsApp />
    </Suspense>
  );
}
