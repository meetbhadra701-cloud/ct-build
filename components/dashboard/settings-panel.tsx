"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "./api";

type Billing = {
  account: { name: string; plan: string } | null;
  has_stripe_customer: boolean;
  subscription: { plan: string; status: string } | null;
};

export function SettingsPanel() {
  const [billing, setBilling] = useState<Billing | null>(null);
  const [plan, setPlan] = useState<"starter" | "growth">("starter");
  const [message, setMessage] = useState("Loading settings.");

  useEffect(() => {
    apiFetch<Billing>("/api/settings/billing")
      .then((response) => {
        setBilling(response);
        setMessage("");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Settings failed to load."));
  }, []);

  async function redirectFrom(path: string, body?: unknown) {
    const response = await apiFetch<{ url: string }>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined
    });
    window.location.assign(response.url);
  }

  return (
    <>
      <header className="page-header">
        <p className="eyebrow">Account</p>
        <h1>Settings</h1>
      </header>
      {message ? <p role="status">{message}</p> : null}
      <section className="section-block" aria-labelledby="billing-title">
        <h2 id="billing-title">Billing</h2>
        <p>
          Current plan: <strong>{billing?.subscription?.plan ?? billing?.account?.plan ?? "trial"}</strong>
        </p>
        <p>Status: {billing?.subscription?.status ?? "No subscription yet"}</p>
        {billing?.has_stripe_customer ? (
          <div className="action-row">
            <button className="button-primary" type="button" onClick={() => redirectFrom("/api/stripe/portal")}>
              Manage billing
            </button>
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="upgrade-plan">Upgrade plan</label>
              <select
                id="upgrade-plan"
                value={plan}
                onChange={(event) => setPlan(event.target.value as "starter" | "growth")}
              >
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
              </select>
            </div>
            <div className="action-row">
              <button className="button-primary" type="button" onClick={() => redirectFrom("/api/stripe/checkout", { plan })}>
                Upgrade
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
