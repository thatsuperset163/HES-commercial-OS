"use client";

import type { WorkClient } from "@/lib/work/types";
import type { ClientRowSignals } from "@/lib/clients/related";
import ClientListRow from "./ClientListRow";

type Props = {
  letter: string;
  clients: WorkClient[];
  selectedId: string | null;
  signals?: Record<string, ClientRowSignals>;
  onOpen: (client: WorkClient) => void;
  sectionRef?: (el: HTMLElement | null) => void;
};

export default function AlphabetSection({
  letter,
  clients,
  selectedId,
  signals,
  onOpen,
  sectionRef,
}: Props) {
  return (
    <section
      className="client-alpha-section"
      aria-labelledby={`client-letter-${letter}`}
      ref={sectionRef}
      data-letter={letter}
    >
      <h3 id={`client-letter-${letter}`} className="client-alpha-sticky">
        {letter}
      </h3>
      <ul className="client-row-list">
        {clients.map((client) => (
          <li key={client.id}>
            <ClientListRow
              client={client}
              selected={selectedId === client.id}
              signals={signals?.[client.id]}
              onOpen={onOpen}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
