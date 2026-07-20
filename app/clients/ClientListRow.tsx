"use client";

import type { KeyboardEvent } from "react";
import type { WorkClient } from "@/lib/work/types";
import {
  clientDisplayName,
  clientInitials,
  clientSecondaryDetail,
} from "@/lib/clients/display";
import ClientInitialsAvatar from "./ClientInitialsAvatar";

type Props = {
  client: WorkClient;
  selected: boolean;
  onOpen: (client: WorkClient) => void;
};

export default function ClientListRow({ client, selected, onOpen }: Props) {
  const onKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(client);
    }
  };

  return (
    <button
      type="button"
      className={`client-row${selected ? " is-selected" : ""}${client.status === "paused" ? " is-paused" : ""}`}
      onClick={() => onOpen(client)}
      onKeyDown={onKey}
      aria-current={selected ? "true" : undefined}
    >
      <ClientInitialsAvatar initials={clientInitials(client)} />
      <span className="client-row-copy">
        <strong>{clientDisplayName(client)}</strong>
        <span>{clientSecondaryDetail(client)}</span>
      </span>
      <span className="client-row-chevron" aria-hidden>
        ›
      </span>
    </button>
  );
}
