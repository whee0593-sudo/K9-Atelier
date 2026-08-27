"use client";

import { useEffect, useState } from "react";
import { BookServiceLink } from "@/components/booking/BookServiceLink";

export function MobileBookBar() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(!entry?.isIntersecting);
      },
      { threshold: 0.08 },
    );

    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Request an appointment"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-line/80 bg-ivory/95 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm md:hidden"
    >
      <BookServiceLink className="inline-flex min-h-[48px] w-full items-center justify-center rounded-sm bg-deep-lavender px-6 text-[10px] font-medium uppercase tracking-[0.16em] text-ivory transition hover:bg-ink">
        Request an Appointment
      </BookServiceLink>
    </div>
  );
}
