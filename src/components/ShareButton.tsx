"use client";

export function ShareButton() {
  async function handleShare() {
    const url = window.location.href;
    const title = "K9 Atelier";

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* user cancelled */
      }
    }

    await navigator.clipboard.writeText(url);
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="text-xs font-medium text-text-muted transition hover:text-gold-dark"
    >
      Share
    </button>
  );
}
