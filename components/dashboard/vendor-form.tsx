"use client";

import { FormEvent, useState } from "react";

import { apiFetch } from "./api";

export type Vendor = {
  id: string;
  name: string;
  contact_email: string | null;
  trade: string | null;
  status: string;
};

export function VendorForm({ onCreated }: { onCreated: (vendor: Vendor) => void }) {
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [trade, setTrade] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("Adding vendor.");

    try {
      const response = await apiFetch<{ vendor: Vendor }>("/api/vendors", {
        method: "POST",
        body: JSON.stringify({
          name,
          contact_email: contactEmail.trim() || null,
          trade: trade.trim() || null,
          status
        })
      });
      onCreated(response.vendor);
      setName("");
      setContactEmail("");
      setTrade("");
      setStatus("active");
      setMessage(`${response.vendor.name} was added.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Vendor could not be added.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form-panel compact-form" onSubmit={submit}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="vendor-name">Vendor name</label>
          <input
            id="vendor-name"
            name="vendor-name"
            required
            autoComplete="organization"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="vendor-email">Contact email</label>
          <input
            id="vendor-email"
            name="vendor-email"
            type="email"
            autoComplete="email"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="vendor-trade">Trade</label>
          <input
            id="vendor-trade"
            name="vendor-trade"
            autoComplete="off"
            value={trade}
            onChange={(event) => setTrade(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="vendor-status">Status</label>
          <select
            id="vendor-status"
            name="vendor-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as "active" | "inactive")}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>
      <div className="action-row">
        <button className="button-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Adding" : "Add vendor"}
        </button>
      </div>
      {message ? <p className="form-message" role="status">{message}</p> : null}
    </form>
  );
}
