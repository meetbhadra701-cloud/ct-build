"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { apiFetch } from "./api";
import { StatusBadge } from "./status-badge";

export function CertificateUpload({ vendorId }: { vendorId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setMessage("Choose a PDF certificate before uploading.");
      return;
    }

    setIsSubmitting(true);
    setMessage("Requesting upload URL.");
    try {
      const upload = await apiFetch<{ storage_key: string; upload_url: string }>(
        "/api/certificates/upload-url",
        {
          method: "POST",
          body: JSON.stringify({
            vendor_id: vendorId,
            filename: file.name,
            content_type: file.type || "application/pdf"
          })
        }
      );

      setMessage("Uploading certificate.");
      const uploadResponse = await fetch(upload.upload_url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/pdf" }
      });
      if (!uploadResponse.ok) throw new Error("Storage upload failed.");

      const created = await apiFetch<{ certificate: { id: string; status: string } }>(
        "/api/certificates",
        {
          method: "POST",
          body: JSON.stringify({
            vendor_id: vendorId,
            storage_key: upload.storage_key,
            source: "upload"
          })
        }
      );

      setStatus(created.certificate.status);
      setMessage("Certificate queued for extraction.");
      pollCertificate(created.certificate.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
      setIsSubmitting(false);
    }
  }

  async function pollCertificate(certificateId: string) {
    const interval = window.setInterval(async () => {
      const detail = await apiFetch<{ certificate: { status: string } }>(
        `/api/certificates/${certificateId}`
      );
      setStatus(detail.certificate.status);
      if (detail.certificate.status !== "processing") {
        window.clearInterval(interval);
        setIsSubmitting(false);
        setMessage("Extraction status updated.");
      }
    }, 3000);
  }

  return (
    <>
      <header className="page-header">
        <p className="eyebrow">Certificate upload</p>
        <h1>Upload certificate</h1>
        <p>PDF files are uploaded directly to private storage using a signed URL.</p>
      </header>
      <form className="form-panel wide-form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="certificate-file">Certificate PDF</label>
          <input
            id="certificate-file"
            name="certificate-file"
            type="file"
            accept="application/pdf"
            required
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>
        <button className="button-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Uploading..." : "Upload certificate"}
        </button>
        {message ? <p role="status">{message}</p> : null}
        {status ? <StatusBadge status={status} /> : null}
      </form>
      <p className="form-footnote">
        <Link href={`/dashboard/vendors/${vendorId}`}>Back to vendor detail</Link>
      </p>
    </>
  );
}
