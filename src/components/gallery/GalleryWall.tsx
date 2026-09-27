"use client";

import React, { useCallback, useRef, useState } from "react";
import { GalleryLightbox } from "./GalleryLightbox";
import { SelectedWorkSection } from "./SelectedWorkSection";

export function GalleryWall() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  const openItem = (id: string, trigger: HTMLElement) => {
    lastTriggerRef.current = trigger;
    setActiveId(id);
  };

  const closeLightbox = useCallback(() => {
    setActiveId(null);
    lastTriggerRef.current?.focus();
  }, []);

  return (
    <>
      <SelectedWorkSection onOpen={openItem} />
      {activeId !== null && (
        <GalleryLightbox
          activeId={activeId}
          onActiveIdChange={setActiveId}
          onClose={closeLightbox}
        />
      )}
    </>
  );
}
