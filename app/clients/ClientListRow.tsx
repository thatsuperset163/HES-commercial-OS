"use client";

import type { KeyboardEvent } from "react";
import type { WorkClient } from "@/lib/work/types";
import {
  clientDisplayName,
  clientInitials,
  clientSecondaryDetail,
} from "@/lib/clients/display";
import type { ClientRowSignals } from "@/lib/clients/related";
import ClientInitialsAvatar from "./ClientInitialsAvatar";

type Props = {
  client: WorkClient;
  selected: boolean;
  signals?: ClientRowSignals;
  onOpen: (client: WorkClient) => void;
};

export default function ClientListRow({
  client,
  selected,
  signals,
  onOpen,
}: Props) {
  const onKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(client);
    }
  };

  return (
    <button
      type="button"
      className={`client-row${selected ? " is-selected" : ""}${client.status === "paused" ? " is-paused" : ""}${client.favorite ? " is-favorite" : ""}`}
      onClick={() => onOpen(client)}
      onKeyDown={onKey}
      aria-current={selected ? "true" : undefined}
    >
      <ClientInitialsAvatar initials={clientInitials(client)} />
      <span className="client-row-copy">
        <strong>
          {client.favorite ? "★ " : ""}
          {clientDisplayName(client)}
        </strong>
        <span>{clientSecondaryDetail(client)}</span>
        <span className="client-row-meta">
          {client.clientType === "commercial" ? "Commercial" : "Residential"}
          {client.phone ? ` · ${client.phone}` : ""}
          {client.city ? ` · ${client.city}` : ""}
        </span>
      </span>
      <span className="client-row-signals" aria-hidden>
        {signals?.upcoming ? <span className="sig upcoming" title="Upcoming job">J</span> : null}
        {signals?.unpaid ? <span className="sig unpaid" title="Open invoice">$</span> : null}
        {signals?.followUp ? <span className="sig follow" title="Quote follow-up">Q</span> : null}
        <span className="client-row-chevron">›</span>
      </span>
    </button>
  );
}
