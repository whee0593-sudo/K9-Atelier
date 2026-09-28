"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import { StarRating } from "@/components/reviews/StarRating";
import type { GoogleReviewItem } from "@/lib/google-reviews";

function reviewText(quote: string) {
  return quote.replace(/\s+/g, " ").trim();
}

function initialFor(name: string) {
  return name.trim().charAt(0).toUpperCase() || "G";
}

export function ReviewCard({ item }: { item: GoogleReviewItem }) {
  const quote = reviewText(item.quote);
  const quoteRef = useRef<HTMLQuoteElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(quote.length > 90);

  useLayoutEffect(() => {
    const element = quoteRef.current;
    if (!element || expanded) return;

    const measure = () => {
      setOverflowing(element.scrollHeight > element.clientHeight + 1);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded, quote]);

  const showToggle = expanded || overflowing;

  return (
    <li className="flex h-full min-w-0 flex-col border border-gray-line/80 bg-ivory px-5 py-6 lg:px-6 lg:py-8">
      <div className="flex items-center gap-3">
        {item.authorPhotoUri ? (
          <img
            src={item.authorPhotoUri}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-deep-lavender font-body text-sm text-ivory"
          >
            {initialFor(item.name)}
          </span>
        )}
        <div className="min-w-0">
          {item.authorUri ? (
            <a
              href={item.authorUri}
              target="_blank"
              rel="noopener noreferrer"
              className="font-body text-sm font-medium text-ink hover:underline"
            >
              {item.name}
            </a>
          ) : (
            <p className="font-body text-sm font-medium text-ink">{item.name}</p>
          )}
          <p className="font-body mt-0.5 text-[10px] uppercase tracking-[0.16em] text-taupe">
            {item.source || "Google Maps"}
          </p>
        </div>
      </div>

      {typeof item.rating === "number" ? (
        <div className="mt-5">
          <StarRating rating={item.rating} />
        </div>
      ) : null}

      <blockquote
        ref={quoteRef}
        className={`font-display mt-5 text-lg leading-snug text-ink lg:text-xl ${
          expanded ? "" : "line-clamp-3"
        }`}
      >
        &ldquo;{quote}&rdquo;
      </blockquote>

      {showToggle ? (
        <button
          type="button"
          className="font-body mt-3 self-start text-[10px] font-medium uppercase tracking-[0.14em] text-taupe hover:text-ink"
          aria-expanded={expanded}
          onClick={() => {
            setOverflowing(true);
            setExpanded((open) => !open);
          }}
        >
          {expanded ? "Show less" : "Show full review"}
        </button>
      ) : null}

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="font-body text-[11px] text-taupe">
          {item.relativePublishTimeDescription || ""}
        </p>
        {item.googleMapsUri ? (
          <a
            href={item.googleMapsUri}
            target="_blank"
            rel="noopener noreferrer"
            className="font-body shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] text-taupe hover:text-ink"
          >
            View on Google
          </a>
        ) : null}
      </div>
    </li>
  );
}
