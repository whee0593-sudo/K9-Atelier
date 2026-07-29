"use client";

import { useState } from "react";
import {
  demoCustomers,
  demoMessages,
  type CustomerMessage,
} from "@/lib/messages";

export function AdminMessageComposer() {
  const [customerId, setCustomerId] = useState(demoCustomers[0]?.id ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState<CustomerMessage[]>(demoMessages);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const customer = demoCustomers.find((c) => c.id === customerId);
    if (!customer || !subject.trim() || !body.trim()) return;

    const newMsg: CustomerMessage = {
      id: `msg-${Date.now()}`,
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      subject: subject.trim(),
      body: body.trim(),
      attachments: [],
      sentAt: new Date().toISOString(),
      sentBy: "Penny",
      read: false,
    };

    demoMessages.unshift(newMsg);
    setSent([...demoMessages]);
    setSubject("");
    setBody("");
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleSend}
        className="rounded-2xl border border-lavender/30 bg-cream p-6"
      >
        <h3 className="font-medium text-gold-dark">Send to Customer</h3>
        <p className="mt-1 text-sm text-text-muted">
          Message and files appear in the customer&apos;s account inbox.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text">
              Customer
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm"
            >
              {demoCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text">
              Subject
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Appointment update, aftercare instructions…"
              className="mt-1.5 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text">
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Write your message to the customer…"
              className="mt-1.5 w-full resize-none rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text">
              Attach File (optional)
            </label>
            <div className="mt-1.5 rounded-xl border border-dashed border-lavender/60 bg-lavender-light/20 px-4 py-6 text-center text-sm text-text-muted">
              PDF, JPG, PNG, DOC — Max 10 MB
              <input type="file" disabled className="mt-3 block w-full text-xs" />
            </div>
            <p className="mt-1 text-xs text-text-muted">
              File upload will be enabled when accounts go live.
            </p>
          </div>

          <button
            type="submit"
            className="rounded-xl bg-gold px-6 py-2.5 text-sm font-medium text-white hover:bg-gold-dark"
          >
            Send to Customer Inbox (preview)
          </button>
        </div>
      </form>

      <div>
        <h3 className="font-medium text-text">Recently Sent</h3>
        <ul className="mt-4 space-y-3">
          {sent.map((msg) => (
            <li
              key={msg.id}
              className="rounded-xl border border-lavender/30 bg-cream px-4 py-3 text-sm"
            >
              <p className="font-medium text-text">
                To: {msg.customerName} — {msg.subject}
              </p>
              <p className="mt-1 text-text-muted line-clamp-2">{msg.body}</p>
              <p className="mt-2 text-xs text-text-muted">
                {new Date(msg.sentAt).toLocaleString()} · {msg.read ? "Read" : "Unread"}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
