"use client";

import { FormEvent, useEffect, useMemo, useRef } from "react";
import { findPossibleClientMatches } from "@/lib/clients/identity";
import type { ClientType, WorkClient } from "@/lib/work/types";

export type AddClientFormState = {
  name: string;
  companyName: string;
  phone: string;
  email: string;
  address: string;
  clientType: ClientType;
  notes: string;
};

type Props = {
  open: boolean;
  form: AddClientFormState;
  saving: boolean;
  clients: WorkClient[];
  onChange: (next: AddClientFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
};

export default function AddClientModal({
  open,
  form,
  saving,
  clients,
  onChange,
  onClose,
  onSubmit,
}: Props) {
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => nameRef.current?.focus(), 30);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, saving, onClose]);

  const matches = useMemo(() => {
    if (!open) return [];
    if (
      !form.name.trim() &&
      !form.email.trim() &&
      !form.phone.trim() &&
      !form.companyName.trim()
    ) {
      return [];
    }
    return findPossibleClientMatches(clients, {
      name: form.name,
      companyName: form.companyName,
      phone: form.phone,
      email: form.email,
      address: form.address,
    }).slice(0, 3);
  }, [open, form, clients]);

  if (!open) return null;

  const set =
    (key: keyof AddClientFormState) =>
    (value: string) =>
      onChange({ ...form, [key]: value });

  return (
    <div
      className="client-add-backdrop"
      role="presentation"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className="client-add-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-add-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="client-add-head">
          <div>
            <p className="hq-eyebrow">Clients</p>
            <h2 id="client-add-title">Add client</h2>
            <p className="client-add-lede">
              One real-world customer = one record. We’ll warn you if this looks
              like someone you already have.
            </p>
          </div>
          <button
            type="button"
            className="btn ghost small"
            disabled={saving}
            onClick={onClose}
          >
            Close
          </button>
        </header>

        <form className="client-add-form" onSubmit={onSubmit}>
          <section className="client-add-section" aria-label="Identity">
            <div className="client-add-type" role="group" aria-label="Client type">
              {(
                [
                  ["residential", "Residential"],
                  ["commercial", "Commercial"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={form.clientType === id ? "is-active" : ""}
                  disabled={saving}
                  onClick={() => onChange({ ...form, clientType: id })}
                >
                  {label}
                </button>
              ))}
            </div>

            <label className="client-add-field">
              <span>
                Name <em>*</em>
              </span>
              <input
                ref={nameRef}
                className="field"
                required
                value={form.name}
                disabled={saving}
                onChange={(e) => set("name")(e.target.value)}
                placeholder="Hal Fisher"
                autoComplete="name"
              />
            </label>

            <label className="client-add-field">
              <span>Company</span>
              <input
                className="field"
                value={form.companyName}
                disabled={saving}
                onChange={(e) => set("companyName")(e.target.value)}
                placeholder="Optional"
                autoComplete="organization"
              />
            </label>
          </section>

          <section className="client-add-section" aria-label="Contact">
            <div className="client-add-row">
              <label className="client-add-field">
                <span>Phone</span>
                <input
                  className="field"
                  type="tel"
                  value={form.phone}
                  disabled={saving}
                  onChange={(e) => set("phone")(e.target.value)}
                  placeholder="(336) 555-0100"
                  autoComplete="tel"
                />
              </label>
              <label className="client-add-field">
                <span>Email</span>
                <input
                  className="field"
                  type="email"
                  value={form.email}
                  disabled={saving}
                  onChange={(e) => set("email")(e.target.value)}
                  placeholder="name@email.com"
                  autoComplete="email"
                />
              </label>
            </div>
            <label className="client-add-field">
              <span>Primary address</span>
              <input
                className="field"
                value={form.address}
                disabled={saving}
                onChange={(e) => set("address")(e.target.value)}
                placeholder="Service address"
                autoComplete="street-address"
              />
            </label>
          </section>

          <section className="client-add-section" aria-label="Notes">
            <label className="client-add-field">
              <span>Notes</span>
              <textarea
                className="field textarea"
                rows={3}
                value={form.notes}
                disabled={saving}
                onChange={(e) => set("notes")(e.target.value)}
                placeholder="Gate code, preferred contact, anything useful…"
              />
            </label>
          </section>

          {matches.length ? (
            <div className="client-add-match" role="status">
              <strong>Possible existing client</strong>
              <ul>
                {matches.map((match) => (
                  <li key={match.client.id}>
                    <span>
                      {match.client.name}
                      {match.client.companyName
                        ? ` · ${match.client.companyName}`
                        : ""}
                    </span>
                    <span className="client-add-match-reason">
                      {match.reason.replaceAll("_", " ")}
                    </span>
                  </li>
                ))}
              </ul>
              <p>
                Saving still creates a new record only if identity doesn’t fully
                match. Prefer opening an existing client when it’s the same
                person.
              </p>
            </div>
          ) : null}

          <footer className="client-add-foot">
            <button
              type="button"
              className="btn secondary"
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn primary"
              disabled={saving || !form.name.trim()}
            >
              {saving ? "Saving…" : "Save client"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
