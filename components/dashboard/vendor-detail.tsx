"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch } from "./api";
import { StatusBadge } from "./status-badge";

type Vendor = { id: string; name: string; trade: string | null; status: string };
type Certificate = { id: string; status: string; created_at: string };
type CertificateDetail = {
  certificate: Certificate;
  coverages: { expiry_date: string | null; coverage_type: string }[];
};

export function VendorDetail({ vendorId }: { vendorId: string }) {
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [certificates, setCertificates] = useState<CertificateDetail[]>([]);
  const [message, setMessage] = useState("Loading vendor.");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const vendorResponse = await apiFetch<{ vendor: Vendor }>(`/api/vendors/${vendorId}`);
        const certResponse = await apiFetch<{ certificates: Certificate[] }>(
          `/api/certificates?vendor_id=${vendorId}`
        );
        const details = await Promise.all(
          certResponse.certificates.map((certificate) =>
            apiFetch<CertificateDetail>(`/api/certificates/${certificate.id}`)
          )
        );
        if (!active) return;
        setVendor(vendorResponse.vendor);
        setCertificates(details);
        setMessage("");
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Vendor failed to load.");
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [vendorId]);

  return (
    <>
      <header className="page-header">
        <p className="eyebrow">Vendor</p>
        <h1>{vendor?.name ?? "Vendor detail"}</h1>
        <p>{vendor?.trade ?? "Trade not set"}</p>
        <Link className="button-primary inline-action" href={`/dashboard/vendors/${vendorId}/upload`}>
          Upload certificate
        </Link>
      </header>
      <section className="section-block" aria-labelledby="certificates-title">
        <h2 id="certificates-title">Certificates</h2>
        {message ? <p role="status">{message}</p> : null}
        <div className="table-wrap">
          <table>
            <caption>Certificates uploaded for this vendor</caption>
            <thead>
              <tr>
                <th scope="col">Certificate</th>
                <th scope="col">Status</th>
                <th scope="col">Expiry date</th>
              </tr>
            </thead>
            <tbody>
              {certificates.map((detail) => (
                <tr key={detail.certificate.id}>
                  <td>{detail.certificate.id.slice(0, 8)}</td>
                  <td>
                    <StatusBadge status={detail.certificate.status} />
                  </td>
                  <td>{firstExpiry(detail.coverages) ?? "Not extracted yet"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function firstExpiry(coverages: CertificateDetail["coverages"]) {
  return coverages
    .map((coverage) => coverage.expiry_date)
    .filter((date): date is string => Boolean(date))
    .sort()[0];
}
