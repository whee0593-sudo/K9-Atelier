"use client";

import { useState } from "react";
import styles from "./coming-soon.module.css";

type Props = {
  signupLabel: string;
  confirmMessage: string;
};

export function ComingSoonNotifyForm({ signupLabel, confirmMessage }: Props) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);

    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = (await res.json()) as { error?: string; ok?: boolean };

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setEmail("");
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (submitted) {
    return <p className={styles.confirm}>{confirmMessage}</p>;
  }

  return (
    <>
      <p className={styles.signupLabel}>{signupLabel}</p>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <input
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          required
          aria-label="Email address"
          className={styles.emailInput}
        />
        <button
          type="submit"
          disabled={sending}
          className={styles.submitButton}
        >
          {sending ? "Sending…" : "Notify Me"}
        </button>
      </form>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
