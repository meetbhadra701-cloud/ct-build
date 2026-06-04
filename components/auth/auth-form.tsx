"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [message, setMessage] = useState(searchParams.get("error") ? "Sign-in could not be completed." : "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createSupabaseBrowserClient();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { company_name: companyName },
              emailRedirectTo: `${window.location.origin}/auth/callback`
            }
          });

    setIsSubmitting(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      setMessage("Check your email to confirm your account, then sign in.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form className="form-panel" onSubmit={onSubmit}>
      {mode === "signup" ? (
        <div className="field">
          <label htmlFor="company-name">Account name</label>
          <input
            id="company-name"
            name="company-name"
            required
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            autoComplete="organization"
          />
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
        />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
      </div>
      {message ? (
        <p className="form-message" role="status">
          {message}
        </p>
      ) : null}
      <button className="button-primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Working..." : mode === "login" ? "Sign in" : "Create account"}
      </button>
      <p className="form-footnote">
        {mode === "login" ? (
          <>
            New here? <Link href="/signup">Create an account</Link>.
          </>
        ) : (
          <>
            Already have an account? <Link href="/login">Sign in</Link>.
          </>
        )}
      </p>
    </form>
  );
}
