export type GalleryFrameSlot = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export const GALLERY_FRAME_SLOTS: readonly GalleryFrameSlot[] = [
  { id: 1, x: 3.5, y: 7, width: 18, height: 39 },
  { id: 2, x: 24, y: 13, width: 10, height: 20 },
  { id: 3, x: 25, y: 36, width: 10, height: 24 },
  { id: 4, x: 38, y: 6, width: 15, height: 31 },
  { id: 5, x: 58, y: 7, width: 15, height: 30 },
  { id: 6, x: 77, y: 8, width: 12, height: 29 },
  { id: 7, x: 90, y: 10, width: 8, height: 19 },
  { id: 8, x: 38, y: 41, width: 9, height: 17 },
  { id: 9, x: 48, y: 41, width: 9, height: 17 },
  { id: 10, x: 37, y: 61, width: 17, height: 29 },
  { id: 11, x: 58, y: 43, width: 15, height: 20 },
  { id: 12, x: 75, y: 43, width: 12, height: 25 },
  { id: 13, x: 88, y: 39, width: 10, height: 22 },
  { id: 14, x: 87, y: 70, width: 9, height: 18 },
  { id: 15, x: 6, y: 66, width: 10, height: 22 },
  { id: 16, x: 20, y: 62, width: 11, height: 27 },
  { id: 17, x: 59, y: 68, width: 14, height: 21 },
];

export const galleryImage = (id: number) =>
  `/images/gallery/gallery-${String(id).padStart(2, "0")}.png`;
