"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch } from "./api";
import { StatusBadge } from "./status-badge";

type Vendor = {
  id: string;
  name: string;
  contact_email: string | null;
  trade: string | null;
  status: string;
};

export function VendorList() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [message, setMessage] = useState("Loading vendors.");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await apiFetch<{ vendors: Vendor[] }>("/api/vendors");
        if (!active) return;
        setVendors(response.vendors);
        setMessage("");
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Vendors failed to load.");
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <header className="page-header">
        <p className="eyebrow">Portfolio</p>
        <h1>Vendors</h1>
      </header>
      <section className="section-block" aria-labelledby="vendors-list-title">
        <div className="section-header">
          <h2 id="vendors-list-title">Vendor directory</h2>
        </div>
        {message ? <p role="status">{message}</p> : null}
        <div className="table-wrap">
          <table>
            <caption>Vendor directory with contact, trade, and active status</caption>
            <thead>
              <tr>
                <th scope="col">Vendor</th>
                <th scope="col">Contact</th>
                <th scope="col">Trade</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => (
                <tr key={vendor.id}>
                  <td>
                    <Link href={`/dashboard/vendors/${vendor.id}`}>{vendor.name}</Link>
                  </td>
                  <td>{vendor.contact_email ?? "Not set"}</td>
                  <td>{vendor.trade ?? "Not set"}</td>
                  <td>
                    <StatusBadge status={vendor.status} />
                  </td>
                </tr>
              ))}
              {!message && vendors.length === 0 ? (
                <tr>
                  <td colSpan={4}>No vendors have been added yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
