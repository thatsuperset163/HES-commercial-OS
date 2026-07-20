"use client";

import { useEffect, useId, useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export default function ClientSearch({ value, onChange }: Props) {
  const id = useId();
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => {
    const t = window.setTimeout(() => onChange(local), 140);
    return () => window.clearTimeout(t);
  }, [local, onChange]);

  return (
    <div className="client-search">
      <label className="sr-only" htmlFor={id}>
        Find a client
      </label>
      <input
        id={id}
        type="search"
        className="client-search-input"
        placeholder="Find a client"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      {local ? (
        <button
          type="button"
          className="client-search-clear"
          aria-label="Clear search"
          onClick={() => {
            setLocal("");
            onChange("");
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
