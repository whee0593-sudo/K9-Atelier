"use client";

import { useState } from "react";

export function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function resolveShareUrl() {
    try {
      const res = await fetch("/api/site-access/share-link");
      if (res.ok) {
        const data = (await res.json()) as { url?: string };
        if (data.url) return data.url;
      }
    } catch {
      /* fall back to current page */
    }
    return window.location.href;
  }

  async function handleShare() {
    const url = await resolveShareUrl();
    const title = "K9 Atelier — Preview";

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* user cancelled or unsupported fields */
      }
    }

    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="text-xs font-medium text-text-muted transition hover:text-gold-dark"
    >
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
