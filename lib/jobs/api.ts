import type { Job, JobInput } from "./types";

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; error: { code: string; message: string } };

async function parse<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ApiOk<T> | ApiErr;
  if (!res.ok || !json.ok) {
    const message =
      !json.ok && "error" in json
        ? json.error.message
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return json.data;
}

export async function fetchJobs(): Promise<Job[]> {
  const res = await fetch("/api/jobs", { credentials: "same-origin" });
  const data = await parse<{ jobs: Job[] }>(res);
  return data.jobs;
}

export async function createJobRemote(input: JobInput & { id?: string }): Promise<Job> {
  const res = await fetch("/api/jobs", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parse<{ job: Job }>(res);
  return data.job;
}

export async function updateJobRemote(
  id: string,
  patch: Partial<Job> & { action?: string },
): Promise<Job> {
  const res = await fetch(`/api/jobs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await parse<{ job: Job }>(res);
  return data.job;
}

export async function deleteJobRemote(id: string): Promise<void> {
  const res = await fetch(`/api/jobs/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  await parse<{ id: string }>(res);
}
