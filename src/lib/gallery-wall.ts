/**
 * Numbered salon gallery wall (no digital frames).
 * Workflow: user sends a photo + slot number → set photoSrc on that slot.
 * Photos fill the dashed placeholder shapes directly.
 */

export const GALLERY_WALL = {
  src: "/images/gallery/museum-wall.webp",
  width: 1024,
  height: 682,
  /** Deep forest / olive-black sampled from the wall edges. */
  background: "#11120a",
  alt: "Dark museum gallery wall with warm ceiling lights, a wood floor, a patterned rug, and seventeen numbered photo placeholders",
} as const;

export type GalleryFrameShape = "rect" | "oval";

export type GalleryFrameSlot = {
  /** Slot number shown on the wall (1–17). */
  id: number;
  shape: GalleryFrameShape;
  /** Bounds as a percent of the wall image (0–100). */
  x: number;
  y: number;
  width: number;
  height: number;
  photoSrc?: string;
  photoAlt?: string;
  /**
   * Scale inside the slot (1 = fill/fit the slot).
   * Use < 1 for breathing room.
   */
  photoScale?: number;
  /** CSS object-position, e.g. "center 42%". */
  photoPosition?: string;
  /**
   * "cover" = fill dashed shape (default, for bare photos).
   * "framed" = keep full pre-made frame, contain + no shape clip.
   */
  fit?: "cover" | "framed";
};

/**
 * Measured against the numbered dashed placeholders on museum-wall.webp.
 * To place a photo later: set photoSrc (and optional photoAlt) on the matching id.
 */
export const GALLERY_FRAME_SLOTS: readonly GalleryFrameSlot[] = [
  { id: 1, shape: "oval", x: 4.88, y: 3.08, width: 18.55, height: 55.43 },
  { id: 2, shape: "rect", x: 25.2, y: 18.33, width: 6.64, height: 12.02 },
  { id: 3, shape: "rect", x: 25.2, y: 35.92, width: 7.62, height: 19.5 },
  { id: 4, shape: "rect", x: 35.35, y: 3.08, width: 15.14, height: 34.6 },
  { id: 5, shape: "rect", x: 57.03, y: 3.08, width: 16.02, height: 31.82 },
  { id: 6, shape: "oval", x: 76.0, y: 4.84, width: 12.2, height: 33.0 },
  { id: 7, shape: "rect", x: 90.0, y: 6.5, width: 6.5, height: 14.5 },
  { id: 8, shape: "rect", x: 36.33, y: 41.35, width: 5.37, height: 10.56 },
  { id: 9, shape: "rect", x: 45.7, y: 41.35, width: 5.27, height: 10.56 },
  { id: 10, shape: "rect", x: 35.35, y: 55.72, width: 16.41, height: 24.49 },
  { id: 11, shape: "oval", x: 57.42, y: 45.89, width: 13.77, height: 14.22 },
  { id: 12, shape: "rect", x: 74.12, y: 43.4, width: 11.23, height: 20.67 },
  { id: 13, shape: "rect", x: 88.28, y: 39.3, width: 8.01, height: 16.86 },
  { id: 14, shape: "rect", x: 86.23, y: 69.5, width: 6.15, height: 12.02 },
  { id: 15, shape: "rect", x: 6.74, y: 64.96, width: 7.42, height: 15.1 },
  { id: 16, shape: "rect", x: 21.29, y: 60.26, width: 8.3, height: 19.06 },
  { id: 17, shape: "rect", x: 59.38, y: 64.52, width: 12.01, height: 17.3 },
];
