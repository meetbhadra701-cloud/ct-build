"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "./api";

type ReviewDetailResponse = {
  review: { id: string; reason: string; status: string };
  certificate: { id: string; status: string } | null;
  extraction: {
    normalized: {
      insured_name?: string | null;
      certificate_holder?: string | null;
      coverages?: Array<Record<string, unknown>>;
    };
    confidence: string;
  } | null;
};

export function ReviewDetail({ reviewId }: { reviewId: string }) {
  const [detail, setDetail] = useState<ReviewDetailResponse | null>(null);
  const [message, setMessage] = useState("Loading review.");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch<ReviewDetailResponse>(`/api/reviews/${reviewId}`)
      .then((response) => {
        if (!active) return;
        setDetail(response);
        setMessage("");
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : "Review failed to load.");
      });
    return () => {
      active = false;
    };
  }, [reviewId]);

  async function resolve(decision: "approve" | "reject") {
    setIsSubmitting(true);
    setMessage(`${decision === "approve" ? "Approving" : "Rejecting"} review.`);
    try {
      await apiFetch(`/api/reviews/${reviewId}/resolve`, {
        method: "POST",
        body: JSON.stringify({
          resolution: {
            decision,
            notes: decision === "approve" ? "Approved from dashboard review." : "Rejected from dashboard review."
          }
        })
      });
      setMessage("Review resolved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Review resolution failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const normalized = detail?.extraction?.normalized;

  return (
    <>
      <header className="page-header">
        <p className="eyebrow">Human review</p>
        <h1>Review detail</h1>
        {detail ? <p>{detail.review.reason}</p> : null}
      </header>
      {message ? <p role="status">{message}</p> : null}
      <section className="section-block" aria-labelledby="extracted-fields-title">
        <h2 id="extracted-fields-title">Extracted fields</h2>
        <dl className="detail-list">
          <div>
            <dt>Insured name</dt>
            <dd>{normalized?.insured_name ?? "Not extracted"}</dd>
          </div>
          <div>
            <dt>Certificate holder</dt>
            <dd>{normalized?.certificate_holder ?? "Not extracted"}</dd>
          </div>
          <div>
            <dt>Confidence</dt>
            <dd>{detail?.extraction?.confidence ?? "Not available"}</dd>
          </div>
        </dl>
        <h3>Coverage lines</h3>
        <pre className="json-panel">{JSON.stringify(normalized?.coverages ?? [], null, 2)}</pre>
      </section>
      <section className="action-row" aria-label="Resolve review">
        <button className="button-primary" type="button" onClick={() => resolve("approve")} disabled={isSubmitting}>
          Approve
        </button>
        <button className="button-secondary" type="button" onClick={() => resolve("reject")} disabled={isSubmitting}>
          Reject
        </button>
      </section>
    </>
  );
}
