/**
 * Lock document scrolling while a modal/menu is open.
 * Nested locks are ref-counted so overlapping UI can open/close safely.
 *
 * Does not set overflow:hidden on html/body — that breaks position:sticky
 * headers when the page is mid-scroll. Uses non-passive wheel/touch guards
 * instead, while still allowing scroll inside allowlisted panels.
 */

let lockCount = 0;

function isScrollAllowedTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "#mobile-nav, [role='dialog'], [data-scroll-lock-allow]",
    ),
  );
}

function preventBackgroundScroll(event: Event) {
  if (isScrollAllowedTarget(event.target)) return;
  event.preventDefault();
}

export function lockBodyScroll() {
  if (typeof document === "undefined") return;
  if (lockCount === 0) {
    document.addEventListener("touchmove", preventBackgroundScroll, {
      passive: false,
    });
    document.addEventListener("wheel", preventBackgroundScroll, {
      passive: false,
    });
  }
  lockCount += 1;
}

export function unlockBodyScroll() {
  if (typeof document === "undefined") return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.removeEventListener("touchmove", preventBackgroundScroll);
    document.removeEventListener("wheel", preventBackgroundScroll);
  }
}
