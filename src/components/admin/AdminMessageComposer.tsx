"use client";

import { useCallback, useEffect, useState } from "react";
import { CallCustomerButton } from "@/components/admin/CallCustomerButton";
import {
  STAFF_SMS_MAX_CHARS,
  type StaffSmsRecipient,
} from "@/lib/sms/staff-compose-copy";
import type { StaffSmsInboxItem } from "@/lib/sms/inbox-copy";

export function AdminMessageComposer() {
  const [recipients, setRecipients] = useState<StaffSmsRecipient[]>([]);
  const [inbox, setInbox] = useState<StaffSmsInboxItem[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (keepCustomer = true) => {
    const response = await fetch("/api/admin/messages", {
      credentials: "include",
    });
    const body = (await response.json()) as {
      recipients?: StaffSmsRecipient[];
      inbox?: StaffSmsInboxItem[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(body.error ?? "Could not load customers.");
    }
    const list = body.recipients ?? [];
    setRecipients(list);
    setInbox(body.inbox ?? []);
    if (!keepCustomer) {
      const first = list.find((item) => item.canText);
      if (first) setCustomerId(first.id);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void load(false)
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load customers.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const selected = recipients.find((item) => item.id === customerId);
  const canSend =
    Boolean(selected?.canText) &&
    message.trim().length > 0 &&
    message.trim().length <= STAFF_SMS_MAX_CHARS &&
    !sending;

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    if (!canSend || !selected) return;

    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selected.id,
          message: message.trim(),
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Could not send the text.");
        return;
      }

      setMessage("");
      await load();
    } catch {
      setError("Could not send the text.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleSend}
        className="rounded-2xl border border-lavender/30 bg-cream p-6"
      >
        <h3 className="font-medium text-gold-dark">Text a customer</h3>
        <p className="mt-1 text-sm text-text-muted">
          Sends from the studio number. Replies are forwarded to your phone and
          listed below. Guests can reply STOP to opt out.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="sms-customer" className="block text-sm font-medium text-text">
              Customer
            </label>
            <div className="mt-1.5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                id="sms-customer"
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                disabled={loading || recipients.length === 0}
                className="w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm"
              >
                {loading ? (
                  <option value="">Loading customers…</option>
                ) : error && recipients.length === 0 ? (
                  <option value="">Could not load customers</option>
                ) : recipients.length === 0 ? (
                  <option value="">No customers yet</option>
                ) : (
                  recipients.map((item) => (
                    <option key={item.id} value={item.id} disabled={!item.canText}>
                      {item.canText
                        ? `${item.name} · ${item.phone}`
                        : `${item.name} · no mobile number`}
                    </option>
                  ))
                )}
              </select>
              <CallCustomerButton
                customerId={selected?.id}
                disabled={!selected?.canText}
              />
            </div>
          </div>

          <div>
            <label htmlFor="sms-body" className="block text-sm font-medium text-text">
              Message
            </label>
            <textarea
              id="sms-body"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={5}
              maxLength={STAFF_SMS_MAX_CHARS}
              placeholder="Bella is ready for pickup…"
              className="mt-1.5 w-full resize-none rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm"
            />
            <p className="mt-1 text-xs text-text-muted">
              {message.trim().length}/{STAFF_SMS_MAX_CHARS} · Sent as “K9 ATELIER: …”
            </p>
          </div>

          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!canSend}
            className="rounded-xl bg-gold px-6 py-2.5 text-sm font-medium text-white hover:bg-gold-dark disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send text"}
          </button>
        </div>
      </form>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-medium text-text">Texts & replies</h3>
          <button
            type="button"
            onClick={() => {
              setError(null);
              void load().catch((loadError: unknown) => {
                setError(
                  loadError instanceof Error
                    ? loadError.message
                    : "Could not refresh texts.",
                );
              });
            }}
            className="text-sm font-medium text-gold-dark hover:underline"
          >
            Refresh
          </button>
        </div>
        {inbox.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">
            Customer replies appear here. They are also forwarded to your phone.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {inbox.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-lavender/30 bg-cream px-4 py-3 text-sm"
              >
                <p className="font-medium text-text">
                  {item.direction === "outbound" ? "Sent" : "Reply"}
                  {item.petNames
                    ? ` · ${item.petNames} · ${item.customerName}`
                    : ` · ${item.customerName}`}
                  {` · ${item.phone}`}
                </p>
                <p className="mt-1 text-text-muted">{item.body}</p>
                <p className="mt-2 text-xs text-text-muted">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
