import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";

export const metadata = {
  title: "Sign in - COI Compliance Tracker"
};

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <p className="eyebrow">COI compliance tracker</p>
        <h1 id="login-title">Sign in</h1>
        <Suspense fallback={<p role="status">Loading sign in form.</p>}>
          <AuthForm mode="login" />
        </Suspense>
      </section>
    </main>
  );
}
