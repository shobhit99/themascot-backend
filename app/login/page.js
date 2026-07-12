"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

export default function LoginPage() {
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const form = new FormData(event.currentTarget);
      await signIn("resend-otp", form);
      if (codeSent) {
        window.location.assign("/");
      } else {
        setCodeSent(true);
      }
    } catch (err) {
      setError(err.message || "Unable to sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-mark">M</div>
        <p className="eyebrow">THE MASCOT</p>
        <h1>{codeSent ? "Check your inbox." : "Sign in to create."}</h1>
        <p className="login-intro">
          {codeSent
            ? `We sent a six-digit code to ${email}.`
            : "Enter your email and we’ll send you a one-time sign-in code."}
        </p>

        <form onSubmit={submit} className="login-form">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            readOnly={codeSent}
            required
          />

          {codeSent && (
            <>
              <label htmlFor="code">Six-digit code</label>
              <input
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                autoFocus
                required
              />
            </>
          )}

          <button type="submit" disabled={busy}>
            {busy ? "Please wait…" : codeSent ? "Verify and continue" : "Send sign-in code"}
          </button>
        </form>

        {codeSent && (
          <button className="text-button" type="button" onClick={() => setCodeSent(false)}>
            Use a different email
          </button>
        )}
        <p className="error" role="alert">{error}</p>
      </section>
    </main>
  );
}
