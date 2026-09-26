"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";
import {
  GALLERY_DRAG_THRESHOLD_PX,
  galleryPointerDistance,
  shouldDismissDragHint,
} from "@/lib/gallery-wall";
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
      <HorizontalGallery onOpen={openItem} />
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

function HorizontalGallery({
  onOpen,
}: {
  onOpen: (id: string, trigger: HTMLElement) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const suppressClickRef = useRef(false);
  const dragRef = useRef({
    pointerId: null as number | null,
    startX: 0,
    startY: 0,
    startScroll: 0,
    dragging: false,
    captured: false,
  });
  const [dragging, setDragging] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const delay = media.matches ? 0 : 550;
    const timer = window.setTimeout(() => setHintVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      viewport.scrollLeft += event.deltaY;
      if (shouldDismissDragHint(Math.abs(event.deltaY))) {
        setHintVisible(false);
      }
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, []);

  const dismissHintFromScroll = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (shouldDismissDragHint(Math.abs(viewport.scrollLeft))) {
      setHintVisible(false);
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    suppressClickRef.current = false;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScroll: viewport.scrollLeft,
      dragging: false,
      captured: false,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    const distance = galleryPointerDistance(
      event.clientX - drag.startX,
      event.clientY - drag.startY,
    );

    if (distance >= GALLERY_DRAG_THRESHOLD_PX) {
      if (!drag.captured) {
        viewport.setPointerCapture(event.pointerId);
        drag.captured = true;
      }
      drag.dragging = true;
      setDragging(true);
      viewport.scrollLeft = drag.startScroll - (event.clientX - drag.startX);
    }

    if (shouldDismissDragHint(distance)) {
      setHintVisible(false);
    }
  };

  const endPointerDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    const viewport = viewportRef.current;
    if (drag.captured && viewport?.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
    if (drag.dragging) {
      suppressClickRef.current = true;
    }
    drag.pointerId = null;
    drag.dragging = false;
    drag.captured = false;
    setDragging(false);
  };

  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  };

  const openIfClick = (id: string, trigger: HTMLElement) => {
    if (suppressClickRef.current) return;
    onOpen(id, trigger);
  };

  return (
    <div
      ref={viewportRef}
      className="k9-gallery-viewport"
      data-dragging={dragging ? "true" : "false"}
      role="region"
      aria-label="K9 Atelier museum gallery"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointerDrag}
      onPointerCancel={endPointerDrag}
      onClickCapture={onClickCapture}
      onScroll={dismissHintFromScroll}
    >
      <p className="sr-only">
        This gallery scrolls horizontally. Drag, swipe, use a trackpad, or use
        Shift + mouse wheel to explore.
      </p>
      <div className="k9-gallery-track">
        <SelectedWorkSection onOpen={openIfClick} />
        <div className="k9-gallery-end" aria-hidden="true" />
      </div>
      <DragHint visible={hintVisible} />
    </div>
  );
}

function DragHint({ visible }: { visible: boolean }) {
  return (
    <p
      aria-hidden={visible ? undefined : true}
      className={`k9-gallery-hint font-body text-[10px] uppercase tracking-[0.32em] text-ink/70 ${visible ? "k9-gallery-hint-visible" : ""}`}
    >
      Drag to explore&nbsp;&nbsp;→
    </p>
  );
}
