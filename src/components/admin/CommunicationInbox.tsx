"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  matchesInboxFilter,
  parseCommunicationFilter,
  type CommunicationFilter,
  type InboxRow,
} from "@/lib/communication/present";
import { previewInboxRows } from "@/lib/communication/preview-data";

const FILTERS: Array<{ id: CommunicationFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "messages", label: "Messages" },
  { id: "calls", label: "Calls" },
  { id: "unread", label: "Unread" },
];

export function CommunicationInbox({
  initialFilter = "all",
  preview = false,
}: {
  initialFilter?: CommunicationFilter;
  preview?: boolean;
}) {
  const [filter, setFilter] = useState<CommunicationFilter>(initialFilter);
  const [rows, setRows] = useState<InboxRow[]>(() =>
    preview ? previewInboxRows() : [],
  );
  const [badge, setBadge] = useState(() => (preview ? 3 : 0));
  const [loading, setLoading] = useState(!preview);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callingId, setCallingId] = useState<string | null>(null);
  const [callNote, setCallNote] = useState<string | null>(null);

  useEffect(() => {
    if (preview) return;
    let stop = false;
    async function load() {
      try {
        const response = await fetch("/api/admin/communication", {
          credentials: "include",
        });
        const body = (await response.json()) as {
          rows?: InboxRow[];
          unavailable?: boolean;
          badge?: number;
          error?: string;
        };
        if (stop) return;
        if (!response.ok) {
          setError(body.error ?? "Could not load Communication.");
          return;
        }
        setRows(body.rows ?? []);
        setBadge(body.badge ?? 0);
        setUnavailable(Boolean(body.unavailable));
        setError(null);
      } catch {
        if (!stop) setError("Could not load Communication.");
      } finally {
        if (!stop) setLoading(false);
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 8000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [preview]);

  const visible = useMemo(
    () => rows.filter((row) => matchesInboxFilter(row, filter)),
    [rows, filter],
  );

  async function callBack(row: InboxRow) {
    if (preview) {
      setCallingId(row.id);
      setCallNote("Calling…");
      return;
    }
    setCallingId(row.id);
    setCallNote("Calling…");
    try {
      const response = await fetch(`/api/admin/communication/${row.id}/call`, {
        method: "POST",
        credentials: "include",
      });
      const body = (await response.json()) as { error?: string; banner?: string };
      if (!response.ok) {
        setCallNote(body.error ?? "Could not start the call.");
        return;
      }
      setCallNote(body.banner ?? "Calling…");
    } catch {
      setCallNote("Could not start the call.");
    }
  }

  return (
    <section className="flex min-h-[100dvh] flex-col bg-ivory">
      <header className="sticky top-0 z-10 border-b border-gray-line bg-ivory/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <Link href="/admin" className="text-sm font-medium text-gold-dark">
            Admin
          </Link>
          <p className="text-xs tracking-[0.16em] text-text-muted">K9 ATELIER</p>
        </div>
        <h1 className="mt-3 flex items-center gap-2 font-display text-4xl text-gold-dark">
          Communication
          {badge > 0 ? (
            <span className="text-2xl font-semibold text-ink">{badge}</span>
          ) : null}
        </h1>
        <div className="mt-4 grid grid-cols-4 gap-1 rounded-2xl bg-lavender-light/70 p-1">
          {FILTERS.map((item) => {
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(item.id)}
                className={`min-h-11 rounded-xl text-sm font-medium ${
                  active ? "bg-ivory text-gold-dark shadow-sm" : "text-text-muted"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1">
        {loading ? (
          <p className="px-4 py-8 text-sm text-text-muted">Loading conversations…</p>
        ) : null}
        {error ? <p className="px-4 py-8 text-sm text-ink">{error}</p> : null}
        {!loading && unavailable ? (
          <p className="px-4 py-8 text-sm leading-6 text-text-muted">
            Communication storage is not ready yet. Run the latest Supabase migration,
            then new calls and texts will show up here.
          </p>
        ) : null}
        {!loading && !error && !unavailable && visible.length === 0 ? (
          <p className="px-4 py-8 text-sm text-text-muted">No conversations in this view.</p>
        ) : null}
        <ul>
          {visible.map((row) => (
            <li key={row.id} className="border-b border-gray-line">
              <Link
                href={
                  preview
                    ? `/admin/communication/preview/thread?who=${row.id}`
                    : `/admin/communication/${row.id}`
                }
                className="flex items-start gap-3 px-4 py-4"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-lg font-semibold text-ink">
                      {row.title}
                      {row.petNames ? ` · ${row.petNames}` : ""}
                    </span>
                    <time className="shrink-0 text-xs text-text-muted">{row.timeLabel}</time>
                  </span>
                  <span className="mt-0.5 block text-sm text-text-muted">{row.phoneDisplay}</span>
                  <span
                    className={`mt-1 block truncate text-sm ${
                      row.unread || row.missed ? "font-medium text-ink" : "text-text-muted"
                    }`}
                  >
                    {row.preview}
                  </span>
                </span>
                {row.unread || row.missed ? (
                  <span
                    className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${
                      row.missed ? "bg-[#9b4d4d]" : "bg-gold-dark"
                    }`}
                    aria-label={row.missed ? "Missed call" : "Unread"}
                  />
                ) : null}
              </Link>
              {row.missed || row.unknown ? (
                <div className="flex gap-2 px-4 pb-4">
                  <button
                    type="button"
                    onClick={() => void callBack(row)}
                    className="min-h-12 flex-1 rounded-2xl bg-gold-dark text-sm font-medium text-ivory"
                  >
                    {callingId === row.id ? "Calling…" : "Call Back"}
                  </button>
                  <Link
                    href={
                      preview
                        ? `/admin/communication/preview/thread?who=${row.id}&compose=1`
                        : `/admin/communication/${row.id}?compose=1`
                    }
                    className="flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-lavender/50 text-sm font-medium text-ink"
                  >
                    {row.missed && !row.hasMessage ? "Text" : "Reply"}
                  </Link>
                </div>
              ) : null}
              {callingId === row.id && callNote ? (
                <p className="px-4 pb-4 text-sm text-text-muted">{callNote}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function parseInboxFilter(value: string | undefined) {
  return parseCommunicationFilter(value);
}
