/**
 * Future-facing linked entity shapes for Notes / Reminders / Files / Activity.
 * Relationships always use clientId. No UI in this PR — storage helpers only.
 */

import { workUid } from "../work/model.ts";
import type { WorkEntityType } from "./resolver.ts";

export type ClientLinkedNote = {
  id: string;
  clientId: string;
  relatedEntityType: WorkEntityType | "";
  relatedEntityId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type ClientLinkedReminder = {
  id: string;
  clientId: string;
  relatedEntityType: WorkEntityType | "";
  relatedEntityId: string;
  dueDate: string;
  title: string;
  notes: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ClientLinkedFile = {
  id: string;
  clientId: string;
  relatedEntityType: WorkEntityType | "";
  relatedEntityId: string;
  name: string;
  url: string;
  kind: "file" | "photo";
  createdAt: string;
  updatedAt: string;
};

export type ClientLinkedActivity = {
  id: string;
  clientId: string;
  relatedEntityType: WorkEntityType | "";
  relatedEntityId: string;
  activityType: string;
  body: string;
  createdAt: string;
};

function requireClientId(clientId: string): string {
  const id = clientId.trim();
  if (!id) {
    throw new Error("clientId is required — never link by name alone");
  }
  return id;
}

export function createClientNote(input: {
  clientId: string;
  body: string;
  relatedEntityType?: WorkEntityType | "";
  relatedEntityId?: string;
}): ClientLinkedNote {
  const now = new Date().toISOString();
  return {
    id: workUid("note"),
    clientId: requireClientId(input.clientId),
    relatedEntityType: input.relatedEntityType ?? "",
    relatedEntityId: (input.relatedEntityId ?? "").trim(),
    body: input.body.trim(),
    createdAt: now,
    updatedAt: now,
  };
}

export function createClientReminder(input: {
  clientId: string;
  title: string;
  dueDate: string;
  notes?: string;
  relatedEntityType?: WorkEntityType | "";
  relatedEntityId?: string;
}): ClientLinkedReminder {
  const now = new Date().toISOString();
  return {
    id: workUid("rem"),
    clientId: requireClientId(input.clientId),
    relatedEntityType: input.relatedEntityType ?? "",
    relatedEntityId: (input.relatedEntityId ?? "").trim(),
    dueDate: input.dueDate.trim(),
    title: input.title.trim() || "Reminder",
    notes: (input.notes ?? "").trim(),
    done: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function createClientFile(input: {
  clientId: string;
  name: string;
  url?: string;
  kind?: "file" | "photo";
  relatedEntityType?: WorkEntityType | "";
  relatedEntityId?: string;
}): ClientLinkedFile {
  const now = new Date().toISOString();
  return {
    id: workUid("file"),
    clientId: requireClientId(input.clientId),
    relatedEntityType: input.relatedEntityType ?? "",
    relatedEntityId: (input.relatedEntityId ?? "").trim(),
    name: input.name.trim() || "File",
    url: (input.url ?? "").trim(),
    kind: input.kind ?? "file",
    createdAt: now,
    updatedAt: now,
  };
}

export function createClientActivity(input: {
  clientId: string;
  activityType: string;
  body: string;
  relatedEntityType?: WorkEntityType | "";
  relatedEntityId?: string;
}): ClientLinkedActivity {
  return {
    id: workUid("cact"),
    clientId: requireClientId(input.clientId),
    relatedEntityType: input.relatedEntityType ?? "",
    relatedEntityId: (input.relatedEntityId ?? "").trim(),
    activityType: input.activityType.trim() || "note",
    body: input.body.trim(),
    createdAt: new Date().toISOString(),
  };
}
