"use client";

import { useRouter } from "next/navigation";

export function ExitPreviewButton() {
  const router = useRouter();

  async function handleExit() {
    await fetch("/api/site-access", { method: "DELETE" });
    router.push("/under-construction");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleExit}
      className="underline hover:text-gold-dark"
    >
      Exit preview
    </button>
  );
}
