"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";

const PHONE =
  (typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_BUSINESS_PHONE?.trim()) ||
  "";
const PHONE_DIGITS = PHONE.replace(/\D/g, "");
const PHONE_HREF = PHONE_DIGITS ? `tel:+${PHONE_DIGITS}` : "#estimate";
const PHONE_DISPLAY = PHONE || "Request an estimate";

export default function SiteApp() {
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError("");
    const fd = new FormData(event.currentTarget);
    const payload = {
      name: String(fd.get("name") || ""),
      phone: String(fd.get("phone") || ""),
      email: String(fd.get("email") || ""),
      address: String(fd.get("address") || ""),
      message: String(fd.get("message") || ""),
      company: String(fd.get("company") || ""),
    };
    try {
      const res = await fetch("/api/public/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setStatus("error");
        setError("Could not send. Call or text us instead.");
        return;
      }
      setStatus("ok");
      event.currentTarget.reset();
    } catch {
      setStatus("error");
      setError("Could not send. Call or text us instead.");
    }
  }

  return (
    <div className="site-root">
      <header className="site-top">
        <div className="site-brand">
          <Image
            src="/hes-logo.png"
            alt="Harris Exterior Solutions"
            width={56}
            height={56}
            priority
          />
          <div>
            <p className="site-brand-eyebrow">Harris Exterior Solutions</p>
            <p className="site-brand-sub">Exterior cleaning · Local &amp; reliable</p>
          </div>
        </div>
        <a className="site-top-cta" href={PHONE_HREF}>
          Call now
        </a>
      </header>

      <section className="site-hero" aria-label="Harris Exterior Solutions">
        <div className="site-hero-media" role="img" aria-label="Freshly cleaned home exterior" />
        <div className="site-hero-copy">
          <p className="site-kicker">Harris Exterior Solutions</p>
          <h1>Clean exteriors. Clear curb appeal.</h1>
          <p className="site-lede">
            Pressure washing, window cleaning, and junk removal — booked with a
            real local crew, not a call center.
          </p>
          <div className="site-hero-actions">
            <a className="site-btn primary" href="#estimate">
              Request an estimate
            </a>
            <a className="site-btn ghost" href={PHONE_HREF}>
              {PHONE_DISPLAY}
            </a>
          </div>
        </div>
      </section>

      <section className="site-section" id="services">
        <h2>What we clean</h2>
        <p className="site-section-lede">
          Residential and light commercial — the work that makes a property look
          cared for.
        </p>
        <ul className="site-services">
          <li>
            <h3>Pressure washing</h3>
            <p>Homes, siding, and commercial exteriors washed clean.</p>
          </li>
          <li>
            <h3>Window cleaning</h3>
            <p>Interior and exterior glass that looks sharp again.</p>
          </li>
          <li>
            <h3>Junk removal</h3>
            <p>Haul-away for clutter, debris, and clean-out jobs.</p>
          </li>
        </ul>
      </section>

      <section className="site-section site-estimate" id="estimate">
        <h2>Request an estimate</h2>
        <p className="site-section-lede">
          Tell us where and what you need. It lands in our Requests desk the same
          day.
        </p>
        <form className="site-form" onSubmit={onSubmit}>
          <label>
            Name
            <input name="name" required autoComplete="name" />
          </label>
          <label>
            Phone
            <input name="phone" type="tel" autoComplete="tel" />
          </label>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" />
          </label>
          <label>
            Property address
            <input name="address" autoComplete="street-address" />
          </label>
          <label>
            What do you need cleaned?
            <textarea name="message" rows={4} />
          </label>
          <label className="site-hp" aria-hidden="true">
            Company
            <input name="company" tabIndex={-1} autoComplete="off" />
          </label>
          <button
            type="submit"
            className="site-btn primary"
            disabled={status === "sending"}
          >
            {status === "sending" ? "Sending…" : "Send request"}
          </button>
          {status === "ok" ? (
            <p className="site-form-ok">Got it — we will follow up soon.</p>
          ) : null}
          {status === "error" ? <p className="site-form-error">{error}</p> : null}
        </form>
      </section>

      <footer className="site-foot">
        <p>© {new Date().getFullYear()} Harris Exterior Solutions</p>
        <Link href="/login">Team login</Link>
      </footer>
    </div>
  );
}
