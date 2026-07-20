"use client";

import { FormEvent, useState } from "react";
import type { WorkClient } from "@/lib/work/types";
import {
  addClientProperty,
  removeClientProperty,
  setClientPrimaryAddress,
} from "@/lib/work/model";

type Props = {
  client: WorkClient;
  onSave: (client: WorkClient) => void;
};

function mapsHref(address: string) {
  return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
}

export default function ClientProperties({ client, onSave }: Props) {
  const [adding, setAdding] = useState(false);
  const [line, setLine] = useState("");
  const [label, setLabel] = useState("");
  const extras = client.properties ?? [];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!line.trim()) return;
    onSave(addClientProperty(client, { line, label }));
    setLine("");
    setLabel("");
    setAdding(false);
  };

  return (
    <section className="client-drawer-section">
      <h3>Properties</h3>

      <ul className="client-property-list">
        <li className="client-property-row is-primary">
          <div className="client-property-copy">
            <span className="client-property-badge">Primary</span>
            <strong>{client.address.trim() || "No primary address yet"}</strong>
          </div>
          {client.address.trim() ? (
            <a
              className="btn ghost small"
              href={mapsHref(client.address)}
              target="_blank"
              rel="noreferrer"
            >
              Maps
            </a>
          ) : null}
        </li>

        {extras.map((prop) => (
          <li key={prop.id} className="client-property-row">
            <div className="client-property-copy">
              {prop.label ? (
                <span className="client-property-badge">{prop.label}</span>
              ) : null}
              <strong>{prop.line}</strong>
            </div>
            <div className="client-property-actions">
              <a
                className="btn ghost small"
                href={mapsHref(prop.line)}
                target="_blank"
                rel="noreferrer"
              >
                Maps
              </a>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => onSave(setClientPrimaryAddress(client, prop.line))}
              >
                Make primary
              </button>
              <button
                type="button"
                className="btn ghost small"
                aria-label={`Remove ${prop.label || prop.line}`}
                onClick={() => onSave(removeClientProperty(client, prop.id))}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      {adding ? (
        <form className="client-property-form" onSubmit={submit}>
          <label>
            Address
            <input
              value={line}
              onChange={(e) => setLine(e.target.value)}
              placeholder="450 N Spring St"
              required
              autoFocus
            />
          </label>
          <label>
            Label <span className="muted">(optional)</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Shop, warehouse, rental…"
            />
          </label>
          <div className="client-property-form-actions">
            <button
              type="button"
              className="btn ghost small"
              onClick={() => {
                setAdding(false);
                setLine("");
                setLabel("");
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn primary small">
              Save address
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="btn ghost small client-add-address"
          onClick={() => setAdding(true)}
        >
          + Add an address
        </button>
      )}
    </section>
  );
}
