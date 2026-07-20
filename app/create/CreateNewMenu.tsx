"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  CREATE_NEW_GROUPS,
  CREATE_NEW_OPTIONS,
  type CreateNewKind,
  type CreateNewOption,
} from "@/lib/createNew/catalog";

type Props = {
  label?: string;
  /** Compact button for tight headers */
  size?: "default" | "small";
  className?: string;
  onSelect: (kind: CreateNewKind) => void;
};

export default function CreateNewMenu({
  label = "Create New",
  size = "default",
  className = "",
  onSelect,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [activeIndex, setActiveIndex] = useState(0);
  const options = CREATE_NEW_OPTIONS;

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const pick = (option: CreateNewOption) => {
    close();
    onSelect(option.id);
  };

  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(options.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) pick(option);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    }
  };

  return (
    <div
      className={`create-new ${className}${open ? " is-open" : ""}`}
      ref={rootRef}
    >
      <button
        type="button"
        className={`btn primary${size === "small" ? " small" : ""} create-new-trigger`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          setOpen((v) => !v);
          setActiveIndex(0);
        }}
      >
        {label}
        <span className="create-new-caret" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div
          id={menuId}
          className="create-new-panel"
          role="menu"
          aria-label={label}
          tabIndex={-1}
          onKeyDown={onMenuKey}
        >
          {CREATE_NEW_GROUPS.map((group) => {
            const rows = options.filter((o) => o.group === group.id);
            return (
              <div key={group.id} className="create-new-group" role="group" aria-label={group.label}>
                <p className="create-new-group-label">{group.label}</p>
                <ul className="create-new-list">
                  {rows.map((option) => {
                    const index = options.findIndex((o) => o.id === option.id);
                    return (
                      <li key={option.id}>
                        <button
                          type="button"
                          role="menuitem"
                          className={`create-new-item${index === activeIndex ? " is-active" : ""}`}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => pick(option)}
                        >
                          <span className={`create-new-mark kind-${option.id}`} aria-hidden>
                            {option.mark}
                          </span>
                          <span className="create-new-copy">
                            <strong>{option.label}</strong>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
