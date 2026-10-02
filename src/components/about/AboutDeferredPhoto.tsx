"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";

/**
 * Same idea as the gallery rows: native lazy loading still fetches images
 * that sit inside the browser's threshold. Hide those images until they are
 * near the screen. The frame keeps its aspect ratio, so the page does not jump.
 */
const NEAR_MARGIN = "400px 0px";

export function AboutDeferredPhoto({
  src,
  alt,
  sizes,
  frameClassName,
  objectPosition = "center",
}: {
  src: string;
  alt: string;
  sizes: string;
  frameClassName: string;
  objectPosition?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: NEAR_MARGIN },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`relative ${frameClassName}`}>
      <div
        className="absolute inset-0"
        style={near ? undefined : { contentVisibility: "hidden" }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          quality={90}
          className="object-cover"
          style={{ objectPosition }}
        />
      </div>
    </div>
  );
}
