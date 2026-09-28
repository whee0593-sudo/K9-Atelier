"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { endedCallLabel, liveCallLabel } from "@/lib/communication/present";
import { previewDetail } from "@/lib/communication/preview-data";
import type {
  CommunicationDetail,
  CommunicationTimelineItem,
} from "@/lib/communication/types";

export function CommunicationThread({
  conversationId,
  previewWho,
  compose = false,
}: {
  conversationId?: string;
  previewWho?: string;
  compose?: boolean;
}) {
  const preview = Boolean(previewWho);
  const [detail, setDetail] = useState<CommunicationDetail | null>(() =>
    previewWho ? previewDetail(previewWho) : null,
  );
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(detail?.banner ?? null);
  const [loading, setLoading] = useState(!preview);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const serverSawLive = useRef(false);
  const previewTimers = useRef<number[]>([]);

  useEffect(() => {
    if (!compose) return;
    inputRef.current?.focus();
  }, [compose, detail?.id]);

  useEffect(() => {
    return () => {
      previewTimers.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    const node = scrollerRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [detail?.timeline.length, banner]);

  useEffect(() => {
    if (preview || !conversationId) return;
    let stop = false;
    async function load() {
      try {
        const response = await fetch(`/api/admin/communication/${conversationId}`, {
          credentials: "include",
        });
        const body = (await response.json()) as {
          detail?: CommunicationDetail;
          error?: string;
        };
        if (stop) return;
        if (!response.ok || !body.detail) {
          setError(body.error ?? "Conversation not found.");
          return;
        }
        setDetail(body.detail);
        setError(null);
        const nextBanner = body.detail.banner;
        if (nextBanner && nextBanner !== endedCallLabel()) {
          serverSawLive.current = true;
          setBanner(nextBanner);
        } else if (nextBanner === endedCallLabel()) {
          serverSawLive.current = false;
          setBanner(nextBanner);
        } else if (serverSawLive.current) {
          serverSawLive.current = false;
          setBanner(endedCallLabel());
        }
      } catch {
        if (!stop) setError("Could not load this conversation.");
      } finally {
        if (!stop) setLoading(false);
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [conversationId, preview]);

  async function sendMessage() {
    const text = draft.trim();
    if (!text || !detail) return;
    if (preview) {
      const at = new Date().toISOString();
      const item: CommunicationTimelineItem = {
        kind: "message",
        id: `local-${at}`,
        at,
        direction: "outbound",
        body: `K9 ATELIER: ${text}`,
        timeLabel: "Now",
        status: "sent",
      };
      setDetail({ ...detail, timeline: [...detail.timeline, item] });
      setDraft("");
      return;
    }
    if (!conversationId) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/communication/${conversationId}/messages`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: text }),
        },
      );
      const body = (await response.json()) as {
        detail?: CommunicationDetail;
        error?: string;
      };
      if (!response.ok || !body.detail) {
        setError(body.error ?? "Could not send that message.");
        return;
      }
      setDetail(body.detail);
      setDraft("");
    } catch {
      setError("Could not send that message.");
    } finally {
      setSending(false);
    }
  }

  async function startCall() {
    if (!detail) return;
    if (preview) {
      setBanner("Calling…");
      previewTimers.current.forEach((timer) => window.clearTimeout(timer));
      previewTimers.current = [
        window.setTimeout(() => setBanner("Connecting…"), 1200),
        window.setTimeout(() => setBanner("Connected"), 2400),
      ];
      return;
    }
    if (!conversationId) return;
    setBanner("Calling…");
    setError(null);
    try {
      const response = await fetch(`/api/admin/communication/${conversationId}/call`, {
        method: "POST",
        credentials: "include",
      });
      const body = (await response.json()) as { error?: string; banner?: string };
      if (!response.ok) {
        setBanner(null);
        setError(body.error ?? "Could not start the call.");
        return;
      }
      setBanner(body.banner ?? liveCallLabel("ringing"));
    } catch {
      setBanner(null);
      setError("Could not start the call.");
    }
  }

  if (loading) {
    return <p className="px-4 py-8 text-sm text-text-muted">Loading conversation…</p>;
  }
  if (!detail) {
    return (
      <div className="px-4 py-8">
        <Link href="/admin/communication" className="text-sm font-medium text-gold-dark">
          Back
        </Link>
        <p className="mt-4 text-sm text-ink">{error ?? "Conversation not found."}</p>
      </div>
    );
  }

  const backHref = preview ? "/admin/communication/preview" : "/admin/communication";
  const addHref = preview
    ? "/admin/communication/preview/add"
    : `/admin/communication/${detail.id}/add-customer`;
  const profileHref = detail.customerId
    ? `/admin/pets?customer=${detail.customerId}`
    : "/admin/pets";

  return (
    <section className="flex min-h-[100dvh] flex-col bg-ivory">
      <header className="sticky top-0 z-10 border-b border-gray-line bg-ivory/95 px-4 py-3 backdrop-blur">
        <Link href={backHref} className="text-sm font-medium text-gold-dark">
          Communication
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-ink">{detail.title}</h1>
        {detail.petNames ? <p className="text-base text-text">{detail.petNames}</p> : null}
        <p className="text-sm text-text-muted">{detail.phoneDisplay}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void startCall()}
            className="min-h-12 rounded-2xl bg-gold-dark text-sm font-medium text-ivory"
          >
            Call
          </button>
          {detail.unknown ? (
            <Link
              href={addHref}
              className="flex min-h-12 items-center justify-center rounded-2xl border border-lavender/50 text-sm font-medium text-ink"
            >
              Add Customer
            </Link>
          ) : (
            <Link
              href={profileHref}
              className="flex min-h-12 items-center justify-center rounded-2xl border border-lavender/50 text-sm font-medium text-ink"
            >
              Customer Profile
            </Link>
          )}
        </div>
      </header>

      <div ref={scrollerRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {detail.timeline.map((item) =>
          item.kind === "message" ? (
            <article
              key={item.id}
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                item.direction === "outbound"
                  ? "self-end bg-lavender-light text-ink"
                  : "self-start border border-lavender/30 bg-white text-ink"
              }`}
            >
              <p className="whitespace-pre-wrap">{item.body}</p>
              <p className="mt-1 text-xs text-text-muted">{item.timeLabel}</p>
            </article>
          ) : (
            <article
              key={item.id}
              className="self-center rounded-2xl border border-lavender/30 bg-cream px-4 py-3 text-center"
            >
              <p className="text-sm font-semibold text-ink">{item.label}</p>
              <p className="mt-1 text-sm text-text-muted">
                {item.whenLabel}
                {item.durationLabel ? ` · ${item.durationLabel}` : ""}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => void startCall()}
                  className="min-h-11 rounded-xl bg-gold-dark px-4 text-sm font-medium text-ivory"
                >
                  Call Back
                </button>
                <button
                  type="button"
                  onClick={() => inputRef.current?.focus()}
                  className="min-h-11 rounded-xl border border-lavender/50 px-4 text-sm font-medium text-ink"
                >
                  Text
                </button>
              </div>
            </article>
          ),
        )}
      </div>

      <div className="sticky bottom-0 border-t border-gray-line bg-ivory px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {banner ? (
          <p className="mb-2 text-center text-sm font-medium text-gold-dark">{banner}</p>
        ) : null}
        {error ? <p className="mb-2 text-sm text-ink">{error}</p> : null}
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage();
          }}
        >
          <label className="sr-only" htmlFor="communication-message">
            Message
          </label>
          <textarea
            id="communication-message"
            ref={inputRef}
            rows={2}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Message"
            className="min-h-12 flex-1 resize-none rounded-2xl border border-lavender/40 bg-white px-4 py-3 text-base text-ink"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="min-h-12 rounded-2xl bg-gold-dark px-4 text-sm font-medium text-ivory disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </form>
        <p className="mt-2 text-center text-xs text-text-muted">Sends from (561) 593-3335</p>
      </div>
    </section>
  );
}
