import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";

export const metadata = {
  title: "Create account - COI Compliance Tracker"
};

export default function SignupPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="signup-title">
        <p className="eyebrow">COI compliance tracker</p>
        <h1 id="signup-title">Create account</h1>
        <Suspense fallback={<p role="status">Loading sign up form.</p>}>
          <AuthForm mode="signup" />
        </Suspense>
      </section>
    </main>
  );
}
