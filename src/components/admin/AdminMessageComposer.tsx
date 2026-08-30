"use client";

import { useCallback, useEffect, useState } from "react";
import { CallCustomerButton } from "@/components/admin/CallCustomerButton";
import {
  STAFF_SMS_MAX_CHARS,
  buildStaffCustomerSms,
  formatStaffRecipientLabel,
  matchesStaffRecipientSearch,
  type StaffSmsRecipient,
  type StudioUnknownCaller,
} from "@/lib/sms/staff-compose-copy";
import { isValidSmsPhone } from "@/lib/sms/phone";
import type { StaffSmsInboxItem } from "@/lib/sms/inbox-copy";
import { buildPreviewStaffMessages } from "@/lib/sms/staff-compose-preview";

export function AdminMessageComposer({
  preview = false,
}: {
  preview?: boolean;
}) {
  const [recipients, setRecipients] = useState<StaffSmsRecipient[]>([]);
  const [inbox, setInbox] = useState<StaffSmsInboxItem[]>([]);
  const [unknownCallers, setUnknownCallers] = useState<StudioUnknownCaller[]>([]);
  const [introPreview, setIntroPreview] = useState("");
  const [knownCallerPreview, setKnownCallerPreview] = useState("");
  const [introPhone, setIntroPhone] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [search, setSearch] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendingIntro, setSendingIntro] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (keepCustomer = true) => {
    if (preview) {
      const sample = buildPreviewStaffMessages();
      setRecipients(sample.recipients);
      setInbox(sample.inbox);
      setUnknownCallers(sample.unknownCallers);
      setIntroPreview(sample.introPreview);
      setKnownCallerPreview(sample.knownCallerPreview);
      if (!keepCustomer) {
        const first = sample.recipients.find((item) => item.canText);
        if (first) {
          setCustomerId(first.id);
          setPhone(first.phone);
        }
      }
      return;
    }
    const response = await fetch("/api/admin/messages", {
      credentials: "include",
    });
    const body = (await response.json()) as {
      recipients?: StaffSmsRecipient[];
      inbox?: StaffSmsInboxItem[];
      unknownCallers?: StudioUnknownCaller[];
      introPreview?: string;
      knownCallerPreview?: string;
      error?: string;
    };
    if (!response.ok) {
      throw new Error(body.error ?? "Could not load customers.");
    }
    const list = body.recipients ?? [];
    setRecipients(list);
    setInbox(body.inbox ?? []);
    setUnknownCallers(body.unknownCallers ?? []);
    if (body.introPreview) setIntroPreview(body.introPreview);
    if (body.knownCallerPreview) setKnownCallerPreview(body.knownCallerPreview);
    if (!keepCustomer) {
      const first = list.find((item) => item.canText);
      if (first) {
        setCustomerId(first.id);
        setPhone(first.phone);
      }
    }
  }, [preview]);

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
  const filteredRecipients = recipients.filter((item) =>
    matchesStaffRecipientSearch(item, search),
  );
  const canSendToNumber = isValidSmsPhone(phone) || Boolean(selected?.canText);
  const canSend =
    canSendToNumber &&
    message.trim().length > 0 &&
    message.trim().length <= STAFF_SMS_MAX_CHARS &&
    !sending;

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    if (!canSend) return;

    setSending(true);
    setError(null);
    if (preview) {
      const to = phone.trim() || selected?.phone || "";
      setInbox((current) => [
        {
          id: `preview-out-${Date.now()}`,
          direction: "outbound",
          customerName: selected?.name || to,
          petNames: selected?.petNames.join(", ") ?? "",
          phone: to,
          body: buildStaffCustomerSms(message.trim()),
          createdAt: new Date().toISOString(),
        },
        ...current,
      ]);
      setMessage("");
      setSending(false);
      return;
    }
    try {
      const response = await fetch("/api/admin/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selected?.id,
          phone: phone.trim() || selected?.phone,
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

  async function sendIntro(phone: string) {
    const trimmed = phone.trim();
    if (!trimmed || sendingIntro) return;
    setSendingIntro(trimmed);
    setError(null);
    if (preview) {
      setUnknownCallers((current) => {
        const stamp = new Date().toISOString();
        const exists = current.some((caller) => caller.phone === trimmed);
        if (exists) {
          return current.map((caller) =>
            caller.phone === trimmed
              ? { ...caller, introSentAt: stamp }
              : caller,
          );
        }
        return [
          { phone: trimmed, calledAt: stamp, introSentAt: stamp },
          ...current,
        ];
      });
      setIntroPhone("");
      setSendingIntro(null);
      return;
    }
    try {
      const response = await fetch("/api/admin/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ introPhone: trimmed }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Could not send the missed-call text.");
        return;
      }
      setIntroPhone("");
      await load();
    } catch {
      setError("Could not send the missed-call text.");
    } finally {
      setSendingIntro(null);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-lavender/30 bg-cream p-6">
        <h3 className="font-medium text-gold-dark">Recent callers</h3>
        <p className="mt-1 text-sm text-text-muted">
          Texts send automatically when someone calls. Unknown numbers get the
          website and booking links. Known guests get a shorter reply-and-book
          text. You can still resend or type a number.
        </p>
        <form
          className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void sendIntro(introPhone);
          }}
        >
          <div className="flex-1">
            <label htmlFor="intro-phone" className="block text-sm font-medium text-text">
              Mobile number
            </label>
            <input
              id="intro-phone"
              type="tel"
              value={introPhone}
              onChange={(event) => setIntroPhone(event.target.value)}
              placeholder="(561) 555-0123"
              className="mt-1.5 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={!introPhone.trim() || Boolean(sendingIntro)}
            className="rounded-xl bg-gold px-6 py-2.5 text-sm font-medium text-white hover:bg-gold-dark disabled:opacity-50"
          >
            {sendingIntro === introPhone.trim()
              ? "Sending…"
              : "Send missed-call text"}
          </button>
        </form>
        {introPreview || knownCallerPreview ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {introPreview ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">
                  Unknown caller
                </p>
                <p className="mt-2 whitespace-pre-wrap text-xs text-text-muted">
                  {introPreview}
                </p>
              </div>
            ) : null}
            {knownCallerPreview ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">
                  Known guest
                </p>
                <p className="mt-2 whitespace-pre-wrap text-xs text-text-muted">
                  {knownCallerPreview}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {unknownCallers.length === 0 ? (
          <p className="mt-4 text-sm text-text-muted">
            Numbers that call the studio will appear here.
          </p>
        ) : (
          <ul className="mt-5 space-y-3">
            {unknownCallers.map((caller) => (
              <li
                key={`${caller.phone}-${caller.calledAt}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-lavender/30 px-4 py-3 text-sm"
              >
                <div>
                  <a
                    href={`tel:${caller.phone}`}
                    className="font-medium text-text underline-offset-2 hover:underline"
                  >
                    {caller.label || caller.phone}
                  </a>
                  {caller.label ? (
                    <p className="mt-1 text-xs text-text-muted">{caller.phone}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-text-muted">
                    Called {new Date(caller.calledAt).toLocaleString()}
                    {caller.introSentAt ? " · text sent" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <CallCustomerButton
                    phone={caller.phone}
                    label="Call back"
                    preview={preview}
                  />
                  <button
                    type="button"
                    disabled={Boolean(sendingIntro)}
                    onClick={() => void sendIntro(caller.phone)}
                    className="rounded-xl border border-lavender/40 px-4 py-2 text-sm font-medium text-text hover:border-gold/40 disabled:opacity-50"
                  >
                    {sendingIntro === caller.phone
                      ? "Sending…"
                      : "Send text"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form
        onSubmit={handleSend}
        className="rounded-2xl border border-lavender/30 bg-cream p-6"
      >
        <h3 className="font-medium text-gold-dark">Text a customer</h3>
        <p className="mt-1 text-sm text-text-muted">
          Search or choose a guest, or type any mobile number. Sends from the
          studio number. Replies are forwarded to your phone and listed below.
          Guests can reply STOP to opt out.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="sms-search" className="block text-sm font-medium text-text">
              Search
            </label>
            <input
              id="sms-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pet name, first name, last name, or phone"
              disabled={loading || recipients.length === 0}
              className="mt-1.5 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm"
            />
          </div>

          <div>
            <label htmlFor="sms-customer" className="block text-sm font-medium text-text">
              Customer
            </label>
            <div className="mt-1.5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                id="sms-customer"
                value={customerId}
                onChange={(event) => {
                  const nextId = event.target.value;
                  setCustomerId(nextId);
                  const next = recipients.find((item) => item.id === nextId);
                  setPhone(next?.phone ?? "");
                }}
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
                  <>
                    <option value="">
                      Choose a customer, or type a number below
                    </option>
                    {(selected &&
                    !filteredRecipients.some((item) => item.id === selected.id)
                      ? [selected, ...filteredRecipients]
                      : filteredRecipients
                    ).map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatStaffRecipientLabel(item)}
                      </option>
                    ))}
                  </>
                )}
              </select>
              <CallCustomerButton
                customerId={selected?.id}
                phone={phone.trim() || selected?.phone}
                disabled={!isValidSmsPhone(phone) && !selected?.canText}
                preview={preview}
              />
            </div>
            {!loading && recipients.length > 0 && filteredRecipients.length === 0 ? (
              <p className="mt-2 text-xs text-text-muted">
                No customers match that search.
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="sms-phone" className="block text-sm font-medium text-text">
              Mobile number
            </label>
            <input
              id="sms-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="(561) 555-0123"
              className="mt-1.5 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm"
            />
            <p className="mt-1 text-xs text-text-muted">
              Type any US mobile number to text, or pick a customer above.
            </p>
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
