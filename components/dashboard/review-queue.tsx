"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch } from "./api";

type Review = { id: string; certificate_id: string; reason: string; created_at: string };

export function ReviewQueue() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [message, setMessage] = useState("Loading review queue.");

  useEffect(() => {
    let active = true;
    apiFetch<{ reviews: Review[] }>("/api/reviews?status=open")
      .then((response) => {
        if (!active) return;
        setReviews(response.reviews);
        setMessage(response.reviews.length ? "" : "No open reviews.");
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : "Reviews failed to load.");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <header className="page-header">
        <p className="eyebrow">Human review</p>
        <h1>Review queue</h1>
      </header>
      <section className="section-block" aria-labelledby="open-reviews-title">
        <h2 id="open-reviews-title">Open reviews</h2>
        {message ? <p role="status">{message}</p> : null}
        <ul className="review-list">
          {reviews.map((review) => (
            <li key={review.id}>
              <Link href={`/dashboard/reviews/${review.id}`}>
                Review {review.id.slice(0, 8)} for certificate {review.certificate_id.slice(0, 8)}
              </Link>
              <p>{review.reason}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
