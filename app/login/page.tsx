"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        setError("Wrong PIN. Try again.");
        setLoading(false);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Could not sign in. Check your connection.");
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <div className="login-card">
        <Image
          className="brand-logo"
          src="/hes-logo.png"
          alt="Harris Exterior Solutions"
          width={220}
          height={220}
          priority
        />
        <p className="brand-eyebrow">Private company portal</p>
        <h1>HES OS</h1>
        <p>Enter your PIN to open the operating system.</p>
        <form onSubmit={onSubmit}>
          <input
            className="field"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            placeholder="PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
            autoFocus
          />
          {error ? <p className="login-error">{error}</p> : null}
          <button className="btn accent" type="submit" disabled={loading}>
            {loading ? "Opening…" : "Open HES OS"}
          </button>
        </form>
      </div>
    </main>
  );
}
