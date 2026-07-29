"use client";

import { demoMessages, messagesForCustomer } from "@/lib/messages";

/** Preview: simulates logged-in customer Jane Miller */
const PREVIEW_CUSTOMER_ID = "cust-1";

export function CustomerInbox() {
  const messages = messagesForCustomer(PREVIEW_CUSTOMER_ID);

  if (messages.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-lavender/50 bg-lavender-light/30 px-6 py-10 text-center text-sm text-text-muted">
        No messages from K9 Atelier yet.
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {messages.map((msg) => (
        <li
          key={msg.id}
          className={`rounded-2xl border px-5 py-4 ${
            msg.read
              ? "border-lavender/30 bg-cream"
              : "border-gold/40 bg-lavender-light/40"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <p className="font-medium text-text">{msg.subject}</p>
            {!msg.read && (
              <span className="shrink-0 rounded-full bg-gold px-2 py-0.5 text-xs text-white">
                New
              </span>
            )}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            {msg.body}
          </p>
          {msg.attachments.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-gold-dark">
              {msg.attachments.map((a) => (
                <li key={a.id}>📎 {a.fileName}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-text-muted">
            From {msg.sentBy} · {new Date(msg.sentAt).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
