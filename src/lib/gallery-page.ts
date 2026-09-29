import {
  COLOR_PATH,
  FULL_GROOM_PATH,
  HAND_STRIPPING_PATH,
} from "@/lib/service-page";

export const GALLERY_PATH = "/gallery";
export const GALLERY_PAGE_TITLE =
  "Dog Grooming Gallery | Palm Beach | K9 Atelier";
export const GALLERY_PAGE_DESCRIPTION =
  "Explore K9 Atelier\u2019s grooming portfolio featuring custom haircuts, Asian Fusion styling, hand stripping, creative color and coat-focused grooming in Palm Beach.";
export const GALLERY_PAGE_CANONICAL = "https://k9atelier.com/gallery";
export const GALLERY_PAGE_H1 = "Gallery";
export const GALLERY_PAGE_INTRO =
  "Selected grooming work by K9 Atelier in Palm Beach.";
export const GALLERY_CONTEXT_HEADING = "Grooming as an Individual Craft";
export const GALLERY_CONTEXT_BODY =
  "Every dog brings a different coat, structure and expression. This collection features a selection of K9 Atelier\u2019s work across custom haircuts, Asian Fusion styling, hand stripping and creative grooming.";

export const GALLERY_SERVICE_LINKS = [
  { href: FULL_GROOM_PATH, label: "Full Grooming" },
  { href: HAND_STRIPPING_PATH, label: "Hand Stripping" },
  { href: COLOR_PATH, label: "Creative Color" },
] as const;
