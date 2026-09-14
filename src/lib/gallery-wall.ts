/**
 * Museum gallery wall.
 * Each framed PNG is centered on its matching number on the wall image.
 * Photos are not cropped, masked, or rewritten.
 * Wall portraits are transparent-background framed PNGs so the museum wall shows through.
 *
 * Customer-facing wall paint is CSS (`GALLERY_WALL.background`). Both
 * `museum-wall-numbered.jpg` and `museum-wall.webp` contain visible placement
 * guides and must not be shown to visitors.
 */

export const GALLERY_WALL = {
  src: "/images/gallery/museum-wall-numbered.jpg",
  width: 1024,
  height: 682,
  /** Deep forest / olive-black sampled from the wall edges. */
  background: "#11120a",
  alt: "Dark museum gallery wall with warm ceiling lights, dark wood trim, a wood floor, and a patterned rug",
} as const;

/** Existing wall photographs that still show layout guides. */
export const GALLERY_WALL_GUIDE_ASSETS = [
  "/images/gallery/museum-wall-numbered.jpg",
  "/images/gallery/museum-wall.webp",
] as const;

export const GALLERY_DRAG_THRESHOLD_PX = 5;
export const GALLERY_HINT_DISMISS_PX = 16;
/** Conservative gallery viewport height used for overlap checks. */
export const GALLERY_VIEWPORT_VH = 71;
export const GALLERY_HOVER_SCALE = 1.012;
export const GALLERY_FRAME_PAD_VH = 0.7;
export const GALLERY_FRAME_GAP_VH = 1.2;

export const GALLERY_SECTION_WIDTH_VH = {
  selected: 240,
  competition: 184,
  credentials: 96,
} as const;

export const GALLERY_PLAQUE_SIZE_VH = {
  width: 12,
  height: 8.4,
} as const;

export type GalleryFrameSlot = {
  id: number;
  /** Frame center from the left of the section, in CSS vh units. */
  centerX: number;
  /** Frame center from the top of the gallery viewport, as a percent. */
  centerY: number;
  /** Display width in CSS vh units. Height follows the PNG ratio. */
  displayWidth: number;
  photoSrc: string;
  photoAlt: string;
  photoWidth: number;
  photoHeight: number;
  fit: "framed";
};

export function galleryWallPhotoSrc(id: number) {
  return `/images/gallery/wall/gallery-${String(id).padStart(2, "0")}.png`;
}

/**
 * Selected-work hang: original 17 portraits, two staggered rows, no overlaps.
 * gallery-01 remains gallery-01.png through gallery-17.png — files are unchanged.
 */
export const GALLERY_FRAME_SLOTS: readonly GalleryFrameSlot[] = [
  {
    id: 1,
    centerX: 42,
    centerY: 71.5,
    displayWidth: 12.6,
    photoSrc: galleryWallPhotoSrc(1),
    photoAlt:
      "K9 Atelier grooming portfolio — white dog with braided ears in an ornate oval gold frame",
    photoWidth: 1024,
    photoHeight: 1536,
    fit: "framed",
  },
  {
    id: 2,
    centerX: 46,
    centerY: 29.5,
    displayWidth: 16.5,
    photoSrc: galleryWallPhotoSrc(2),
    photoAlt:
      "K9 Atelier grooming portfolio — Yorkshire Terrier in a paisley bandana, ornate gold frame",
    photoWidth: 1430,
    photoHeight: 1100,
    fit: "framed",
  },
  {
    id: 3,
    centerX: 86,
    centerY: 72,
    displayWidth: 13.2,
    photoSrc: galleryWallPhotoSrc(3),
    photoAlt:
      "K9 Atelier grooming portfolio — cream bichon-style portrait in an ornate gold frame",
    photoWidth: 1141,
    photoHeight: 1378,
    fit: "framed",
  },
  {
    id: 4,
    centerX: 70,
    centerY: 29,
    displayWidth: 13.4,
    photoSrc: galleryWallPhotoSrc(4),
    photoAlt:
      "K9 Atelier grooming portfolio — chocolate-and-white poodle with a floral ribbon, ornate gold frame",
    photoWidth: 1119,
    photoHeight: 1405,
    fit: "framed",
  },
  {
    id: 5,
    centerX: 96,
    centerY: 29,
    displayWidth: 13.4,
    photoSrc: galleryWallPhotoSrc(5),
    photoAlt:
      "K9 Atelier grooming portfolio — white bichon in a red knit scarf, ornate gold frame",
    photoWidth: 1120,
    photoHeight: 1404,
    fit: "framed",
  },
  {
    id: 6,
    centerX: 152,
    centerY: 29,
    displayWidth: 13.2,
    photoSrc: galleryWallPhotoSrc(6),
    photoAlt:
      "K9 Atelier grooming portfolio — Yorkshire Terrier with a top knot in an ornate oval gold frame",
    photoWidth: 1141,
    photoHeight: 1378,
    fit: "framed",
  },
  {
    id: 7,
    centerX: 200,
    centerY: 29.5,
    displayWidth: 16.2,
    photoSrc: galleryWallPhotoSrc(7),
    photoAlt:
      "K9 Atelier grooming portfolio — white dog with creative color accents in an ornate gold frame",
    photoWidth: 1403,
    photoHeight: 1121,
    fit: "framed",
  },
  {
    id: 8,
    centerX: 110,
    centerY: 73,
    displayWidth: 15,
    photoSrc: galleryWallPhotoSrc(8),
    photoAlt:
      "K9 Atelier grooming portfolio — apricot poodle in profile, ornate gold frame",
    photoWidth: 1329,
    photoHeight: 1183,
    fit: "framed",
  },
  {
    id: 9,
    centerX: 134,
    centerY: 71.5,
    displayWidth: 12.8,
    photoSrc: galleryWallPhotoSrc(9),
    photoAlt:
      "K9 Atelier grooming portfolio — white-and-tan dog in a red polka-dot bandana, ornate gold frame",
    photoWidth: 1098,
    photoHeight: 1433,
    fit: "framed",
  },
  {
    id: 10,
    centerX: 158,
    centerY: 73.5,
    displayWidth: 16.5,
    photoSrc: galleryWallPhotoSrc(10),
    photoAlt:
      "K9 Atelier grooming portfolio — white-and-brown dog with pigtails in an ornate gold frame",
    photoWidth: 1374,
    photoHeight: 1145,
    fit: "framed",
  },
  {
    id: 11,
    centerX: 124,
    centerY: 31,
    displayWidth: 17.2,
    photoSrc: galleryWallPhotoSrc(11),
    photoAlt:
      "K9 Atelier grooming portfolio — white dog with rainbow creative color, ornate gold frame",
    photoWidth: 1550,
    photoHeight: 1014,
    fit: "framed",
  },
  {
    id: 12,
    centerX: 176,
    centerY: 30.5,
    displayWidth: 13.6,
    photoSrc: galleryWallPhotoSrc(12),
    photoAlt:
      "K9 Atelier grooming portfolio — cream-and-silver terrier in an ornate gold frame",
    photoWidth: 1215,
    photoHeight: 1295,
    fit: "framed",
  },
  {
    id: 13,
    centerX: 224,
    centerY: 29,
    displayWidth: 12.8,
    photoSrc: galleryWallPhotoSrc(13),
    photoAlt:
      "K9 Atelier grooming portfolio — honey-coated doodle in an ornate gold frame",
    photoWidth: 1024,
    photoHeight: 1536,
    fit: "framed",
  },
  {
    id: 14,
    centerX: 216,
    centerY: 73.5,
    displayWidth: 16,
    photoSrc: galleryWallPhotoSrc(14),
    photoAlt:
      "K9 Atelier grooming portfolio — apricot poodle standing in profile, ornate gold frame",
    photoWidth: 1374,
    photoHeight: 1145,
    fit: "framed",
  },
  {
    id: 15,
    centerX: 22,
    centerY: 72.5,
    displayWidth: 12.8,
    photoSrc: galleryWallPhotoSrc(15),
    photoAlt:
      "K9 Atelier grooming portfolio — brown-and-white poodle with a floral accent, ornate gold frame",
    photoWidth: 1119,
    photoHeight: 1405,
    fit: "framed",
  },
  {
    id: 16,
    centerX: 64,
    centerY: 72,
    displayWidth: 12.6,
    photoSrc: galleryWallPhotoSrc(16),
    photoAlt:
      "K9 Atelier grooming portfolio — plush white dog in an ornate oval gold frame",
    photoWidth: 1024,
    photoHeight: 1536,
    fit: "framed",
  },
  {
    id: 17,
    centerX: 186,
    centerY: 72,
    displayWidth: 13.4,
    photoSrc: galleryWallPhotoSrc(17),
    photoAlt:
      "K9 Atelier grooming portfolio — white dog with creative color and coat art, ornate gold frame",
    photoWidth: 1159,
    photoHeight: 1356,
    fit: "framed",
  },
];

export function getGallerySlot(id: number) {
  return GALLERY_FRAME_SLOTS.find((slot) => slot.id === id);
}

export function galleryWallPhotoSrcFromWorkId(workId: string) {
  const match = /^work-(\d{2})$/.exec(workId);
  if (!match) return undefined;
  return galleryWallPhotoSrc(Number(match[1]));
}

export function workLightboxId(id: number) {
  return `work-${String(id).padStart(2, "0")}`;
}

export function competitionImageSrc(id: number) {
  return `/images/gallery/competition/competition-${String(id).padStart(2, "0")}.jpg`;
}

export type GalleryCaption = {
  kicker?: string;
  title?: string;
  detail?: string;
};

export type CompetitionFrameFinish = "gold" | "walnut" | "brass";

export type CompetitionArchiveItem = {
  id: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  x: number;
  y: number;
  displayWidth: number;
  frame: CompetitionFrameFinish;
  section: "competition" | "credentials";
  caption?: GalleryCaption;
};

export type GalleryLightboxItem = {
  id: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: GalleryCaption;
};

/**
 * Intrinsic width/height are provisional until the JPEGs are placed.
 * Frames use object-fit: contain so a mismatched ratio is never stretched.
 * Only competition-04 carries the 2019 Best in Show caption.
 * Other photographs are teaching notes or show-day snapshots — not a résumé.
 */
export const COMPETITION_ARCHIVE_ITEMS: readonly CompetitionArchiveItem[] = [
  {
    id: "competition-01",
    src: competitionImageSrc(1),
    alt: "Large group of competitors and groomed dogs gathered on a competition floor",
    width: 1800,
    height: 1200,
    x: 46,
    y: 27.5,
    displayWidth: 19,
    frame: "walnut",
    section: "competition",
    caption: {
      kicker: "FROM THE RING",
      title: "Show-day snapshot",
    },
  },
  {
    id: "competition-02",
    src: competitionImageSrc(2),
    alt: "Vertical close-up of a white Bichon Frisé during a teaching or grooming session",
    width: 1200,
    height: 1800,
    x: 48,
    y: 76,
    displayWidth: 12.8,
    frame: "gold",
    section: "competition",
    caption: {
      kicker: "IN THE STUDIO",
      title: "Teaching",
    },
  },
  {
    id: "competition-03",
    src: competitionImageSrc(3),
    alt: "A Bichon Frisé being groomed on the competition floor",
    width: 1800,
    height: 1350,
    x: 82,
    y: 76.5,
    displayWidth: 19,
    frame: "walnut",
    section: "competition",
    caption: {
      kicker: "FROM THE RING",
      title: "Show-day snapshot",
    },
  },
  {
    id: "competition-04",
    src: competitionImageSrc(4),
    alt: "Penny with a white Bichon Frisé, a large trophy, and three ribbons — 2019 Best in Show",
    width: 2000,
    height: 1500,
    x: 82,
    y: 27,
    displayWidth: 24,
    frame: "gold",
    section: "competition",
    caption: {
      kicker: "2019",
      title: "Best in Show",
      detail: "Bichon",
    },
  },
  {
    id: "competition-05",
    src: competitionImageSrc(5),
    alt: "A trophy being handed over on the competition floor",
    width: 1800,
    height: 1200,
    x: 122,
    y: 27.5,
    displayWidth: 19.5,
    frame: "brass",
    section: "competition",
    caption: {
      kicker: "FROM THE RING",
      title: "Show-day snapshot",
    },
  },
  {
    id: "competition-06",
    src: competitionImageSrc(6),
    alt: "Formal portrait of Penny with a white dog during a studio session",
    width: 1200,
    height: 1600,
    x: 122,
    y: 76,
    displayWidth: 13,
    frame: "gold",
    section: "competition",
    caption: {
      kicker: "IN THE STUDIO",
      title: "Teaching",
    },
  },
  {
    id: "competition-07",
    src: competitionImageSrc(7),
    alt: "Close-up of a dark poodle being groomed in the studio",
    width: 1800,
    height: 1200,
    x: 160,
    y: 27.5,
    displayWidth: 18.5,
    frame: "brass",
    section: "competition",
    caption: {
      kicker: "IN THE STUDIO",
      title: "Teaching",
    },
  },
  {
    id: "competition-08",
    src: competitionImageSrc(8),
    alt: "Trophy, ribbons, and notes arranged together on a studio table",
    width: 1800,
    height: 1200,
    x: 48,
    y: 52,
    displayWidth: 30,
    frame: "walnut",
    section: "credentials",
    caption: {
      kicker: "FROM THE TABLE",
      title: "Studio keepsakes",
    },
  },
];

export const COMPETITION_WALL_ITEMS = COMPETITION_ARCHIVE_ITEMS.filter(
  (item) => item.section === "competition",
);

export const CREDENTIALS_ITEMS = COMPETITION_ARCHIVE_ITEMS.filter(
  (item) => item.section === "credentials",
);

export const GALLERY_WINNER_ITEM_ID = "competition-04";

export const GALLERY_WINNER_PLAQUE = {
  year: "2019",
  title: "BEST IN SHOW",
  detail: "Bichon",
  x: 82,
  y: 51,
} as const;

export const SELECTED_WORK_PRIORITY_IDS = new Set([1, 2, 3, 15, 16]);

export const GALLERY_LIGHTBOX_ITEMS: readonly GalleryLightboxItem[] = [
  ...GALLERY_FRAME_SLOTS.map((slot) => ({
    id: workLightboxId(slot.id),
    src: slot.photoSrc,
    alt: slot.photoAlt,
    width: slot.photoWidth,
    height: slot.photoHeight,
  })),
  ...COMPETITION_ARCHIVE_ITEMS.map((item) => ({
    id: item.id,
    src: item.src,
    alt: item.alt,
    width: item.width,
    height: item.height,
    caption: item.caption,
  })),
];

export function getLightboxItem(id: string) {
  return GALLERY_LIGHTBOX_ITEMS.find((item) => item.id === id);
}

export function getLightboxIndex(id: string) {
  return GALLERY_LIGHTBOX_ITEMS.findIndex((item) => item.id === id);
}

export function nextLightboxId(id: string) {
  const index = getLightboxIndex(id);
  const safe = index < 0 ? 0 : index;
  return GALLERY_LIGHTBOX_ITEMS[(safe + 1) % GALLERY_LIGHTBOX_ITEMS.length].id;
}

export function prevLightboxId(id: string) {
  const index = getLightboxIndex(id);
  const safe = index < 0 ? 0 : index;
  const length = GALLERY_LIGHTBOX_ITEMS.length;
  return GALLERY_LIGHTBOX_ITEMS[(safe - 1 + length) % length].id;
}

export function galleryPointerDistance(dx: number, dy: number) {
  return Math.hypot(dx, dy);
}

export function isGalleryClick(distancePx: number) {
  return distancePx < GALLERY_DRAG_THRESHOLD_PX;
}

export function shouldSuppressArtworkOpen(distancePx: number) {
  return !isGalleryClick(distancePx);
}

export function shouldDismissDragHint(distancePx: number) {
  return distancePx >= GALLERY_HINT_DISMISS_PX;
}

export function lightboxCaptionLines(caption?: GalleryCaption) {
  if (!caption) return [];
  const primary = [caption.kicker, caption.title].filter(Boolean).join(" · ");
  return [primary, caption.detail].filter((line): line is string => Boolean(line));
}

export type GalleryBox = {
  id: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export function galleryArtworkBox(opts: {
  id: string;
  centerXVh: number;
  centerYPercent: number;
  widthVh: number;
  photoWidth: number;
  photoHeight: number;
  viewportVh?: number;
  scale?: number;
}): GalleryBox {
  const viewportVh = opts.viewportVh ?? GALLERY_VIEWPORT_VH;
  const scale = opts.scale ?? GALLERY_HOVER_SCALE;
  const width = opts.widthVh * scale + GALLERY_FRAME_PAD_VH * 2;
  const height =
    opts.widthVh * (opts.photoHeight / opts.photoWidth) * scale +
    GALLERY_FRAME_PAD_VH * 2;
  const centerYVh = (opts.centerYPercent / 100) * viewportVh;
  return {
    id: opts.id,
    left: opts.centerXVh - width / 2,
    right: opts.centerXVh + width / 2,
    top: centerYVh - height / 2,
    bottom: centerYVh + height / 2,
  };
}

export function galleryBoxesOverlap(
  a: GalleryBox,
  b: GalleryBox,
  gap = GALLERY_FRAME_GAP_VH,
) {
  return !(
    a.right + gap <= b.left ||
    b.right + gap <= a.left ||
    a.bottom + gap <= b.top ||
    b.bottom + gap <= a.top
  );
}

export function selectedWorkBoxes(viewportVh = GALLERY_VIEWPORT_VH) {
  return GALLERY_FRAME_SLOTS.map((slot) =>
    galleryArtworkBox({
      id: `work-${slot.id}`,
      centerXVh: slot.centerX,
      centerYPercent: slot.centerY,
      widthVh: slot.displayWidth,
      photoWidth: slot.photoWidth,
      photoHeight: slot.photoHeight,
      viewportVh,
    }),
  );
}

export function competitionWallBoxes(viewportVh = GALLERY_VIEWPORT_VH) {
  const frames = COMPETITION_WALL_ITEMS.map((item) =>
    galleryArtworkBox({
      id: item.id,
      centerXVh: item.x,
      centerYPercent: item.y,
      widthVh: item.displayWidth,
      photoWidth: item.width,
      photoHeight: item.height,
      viewportVh,
    }),
  );
  const centerYVh = (GALLERY_WINNER_PLAQUE.y / 100) * viewportVh;
  frames.push({
    id: "winner-plaque",
    left: GALLERY_WINNER_PLAQUE.x - GALLERY_PLAQUE_SIZE_VH.width / 2,
    right: GALLERY_WINNER_PLAQUE.x + GALLERY_PLAQUE_SIZE_VH.width / 2,
    top: centerYVh - GALLERY_PLAQUE_SIZE_VH.height / 2,
    bottom: centerYVh + GALLERY_PLAQUE_SIZE_VH.height / 2,
  });
  return frames;
}

export function overlappingGalleryPairs(boxes: readonly GalleryBox[]) {
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      if (galleryBoxesOverlap(boxes[i], boxes[j])) {
        pairs.push([boxes[i].id, boxes[j].id]);
      }
    }
  }
  return pairs;
}

export function isAwardRésuméCaption(caption?: GalleryCaption) {
  if (!caption) return false;
  const text = [caption.kicker, caption.title, caption.detail]
    .filter(Boolean)
    .join(" ");
  return /2014|2017|Best in Group|Pomeranian|Poodle/.test(text);
}
