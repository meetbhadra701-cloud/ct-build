"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch } from "./api";
import { StatusBadge } from "./status-badge";

type Vendor = { id: string; name: string; trade: string | null; status: string };
type Counts = Record<"compliant" | "expiring-soon" | "expired" | "non-compliant", number>;
type VendorRow = Vendor & { complianceStatus: string };
type CertificateSummary = {
  id: string;
  latest_compliance_result: { status: string } | null;
};

const emptyCounts: Counts = {
  compliant: 0,
  "expiring-soon": 0,
  expired: 0,
  "non-compliant": 0
};

export function DashboardHome() {
  const [counts, setCounts] = useState<Counts>(emptyCounts);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [message, setMessage] = useState("Loading dashboard.");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [rollup, vendorResponse] = await Promise.all([
          apiFetch<{ counts: Counts }>("/api/compliance/rollup"),
          apiFetch<{ vendors: Vendor[] }>("/api/vendors")
        ]);

        const rows = await Promise.all(
          vendorResponse.vendors.map(async (vendor) => {
            const certs = await apiFetch<{ certificates: CertificateSummary[] }>(
              `/api/certificates?vendor_id=${vendor.id}`
            );
            const latest = certs.certificates[0];
            if (!latest) return { ...vendor, complianceStatus: "non-compliant" };
            return {
              ...vendor,
              complianceStatus: latest.latest_compliance_result?.status ?? "non-compliant"
            };
          })
        );

        if (!active) return;
        setCounts(rollup.counts);
        setVendors(rows);
        setMessage("");
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Dashboard failed to load.");
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
        <p className="eyebrow">Operational view</p>
        <h1>Dashboard</h1>
      </header>
      <section aria-label="Compliance counts" className="metric-grid">
        {Object.entries(counts).map(([status, count]) => (
          <article className="metric-card" key={status}>
            <p>{status.replaceAll("-", " ")}</p>
            <strong>{count}</strong>
          </article>
        ))}
      </section>
      <section className="section-block" aria-labelledby="vendors-title">
        <div className="section-header">
          <h2 id="vendors-title">Vendors</h2>
        </div>
        {message ? <p role="status">{message}</p> : null}
        <div className="table-wrap">
          <table>
            <caption>Vendor compliance status summary</caption>
            <thead>
              <tr>
                <th scope="col">Vendor</th>
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
                  <td>{vendor.trade ?? "Not set"}</td>
                  <td>
                    <StatusBadge status={vendor.complianceStatus} />
                  </td>
                </tr>
              ))}
              {!message && vendors.length === 0 ? (
                <tr>
                  <td colSpan={3}>No vendors have been added yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
