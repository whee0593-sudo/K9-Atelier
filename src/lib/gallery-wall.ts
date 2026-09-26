/**
 * Museum gallery wall.
 * Each framed PNG is centered on its matching number on the wall image.
 * Photos are not cropped, masked, or rewritten.
 * Wall portraits are transparent-background framed PNGs so the museum wall shows through.
 *
 * Customer-facing wall paint is the purple plaster in `wall-plaster.png`
 * (`GALLERY_WALL.background` is that tile's average color). Both
 * `museum-wall-numbered.jpg` and `museum-wall.webp` contain visible placement
 * guides and must not be shown to visitors.
 */

export const GALLERY_WALL = {
  src: "/images/gallery/museum-wall-numbered.jpg",
  width: 1024,
  height: 682,
  /** Average color of the purple plaster wall tile. */
  background: "#BA6ED9",
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
} as const;

/** Enlarge wall frames as far as neighboring art and captions allow. */
export const GALLERY_SELECTED_LAYOUT = {
  scale: 1.32,
  topShift: -2,
  bottomShift: 1.8,
} as const;

export const GALLERY_COMPETITION_LAYOUT = {
  scale: 1.28,
  winnerScale: 1.14,
  winnerY: 24.2,
  bottomShift: 1.2,
} as const;

export const GALLERY_CAPTION_OFFSET_VH = 0.55;
export const GALLERY_CAPTION_HEIGHT_VH = 5.4;

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
 * Selected-work hang: original portraits, two staggered rows, no overlaps.
 * gallery-01 remains gallery-01.png through gallery-17.png — unused files stay in place.
 */
export const GALLERY_FRAME_SLOTS: readonly GalleryFrameSlot[] = [
  {
    id: 1,
    centerX: 42,
    centerY: 71.5,
    displayWidth: 12.6,
    photoSrc: galleryWallPhotoSrc(1),
    photoAlt:
      "K9 Atelier grooming portfolio — Maltese with braided ears in an ornate oval gold frame",
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
      "K9 Atelier grooming portfolio — cream poodle portrait in an ornate gold frame",
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
      "K9 Atelier grooming portfolio — Yorkshire Terrier with a Princess look in an ornate oval gold frame",
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
      "K9 Atelier grooming portfolio — white-and-brown Shih Tzu with a daily braid in an ornate gold frame",
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

/**
 * Lightbox / wall captions for selected-work portraits. Indexed by slot id.
 * Two-line museum label: kicker = breed, detail = styling.
 */
export const SELECTED_WORK_CAPTIONS: Record<number, GalleryCaption> = {
  1: { kicker: "Maltese", detail: "Braided ears" },
  2: { kicker: "Yorkshire Terrier", detail: "Puppy cut" },
  3: { kicker: "Poodle", detail: "Teddy bear" },
  4: { kicker: "Poodle", detail: "Asian Fusion" },
  5: { kicker: "Bichon", detail: "Teddy bear" },
  6: { kicker: "Yorkshire Terrier", detail: "Princess look" },
  7: { kicker: "Bichon", detail: "Creative color" },
  8: { kicker: "Poodle", detail: "German trim" },
  9: { kicker: "Shih Tzu", detail: "Full face" },
  10: { kicker: "Shih Tzu", detail: "Daily braid" },
  11: { kicker: "Bichon", detail: "Creative Color Dye" },
  12: { kicker: "Yorkshire Terrier", detail: "Puppy cut" },
  13: { kicker: "Doodle", detail: "Teddy bear" },
  14: { kicker: "Poodle", detail: "Teddy bear" },
  16: { kicker: "Pomeranian", detail: "Boo cut with scarf" },
  17: { kicker: "Bichon", detail: "Creative Color Dye" },
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
  caption: GalleryCaption;
};

export type GalleryLightboxItem = {
  id: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  caption: GalleryCaption;
};

/**
 * Intrinsic width/height match the JPEGs in public/images/gallery/competition/.
 * Frames use object-fit: contain so a mismatched ratio is never stretched.
 * Only competition-04 carries the 2019 Best in Show caption.
 * Other photographs are teaching notes or show-day snapshots — not a résumé.
 */
export const COMPETITION_ARCHIVE_ITEMS: readonly CompetitionArchiveItem[] = [
  {
    id: "competition-01",
    src: competitionImageSrc(1),
    alt: "Large group of competitors and groomed dogs gathered on a competition floor",
    width: 700,
    height: 433,
    x: 46,
    y: 27.5,
    displayWidth: 19,
    frame: "walnut",
    caption: {
      kicker: "FROM THE RING",
      title: "Show-day snapshot",
      detail: "Group portrait",
    },
  },
  {
    id: "competition-02",
    src: competitionImageSrc(2),
    alt: "White Bichon Frisé being groomed during a teaching session",
    width: 1016,
    height: 1080,
    x: 48,
    y: 76,
    displayWidth: 12.8,
    frame: "gold",
    caption: {
      kicker: "IN THE STUDIO",
      title: "Teaching",
      detail: "Bichon",
    },
  },
  {
    id: "competition-03",
    src: competitionImageSrc(3),
    alt: "A Bichon Frisé being groomed on the competition floor",
    width: 5760,
    height: 3840,
    x: 82,
    y: 76.5,
    displayWidth: 19,
    frame: "walnut",
    caption: {
      kicker: "FROM THE RING",
      title: "Show-day snapshot",
      detail: "Bichon",
    },
  },
  {
    id: "competition-04",
    src: competitionImageSrc(4),
    alt: "Penny with a white Bichon Frisé, a large trophy, and three ribbons — 2019 Best in Show",
    width: 960,
    height: 801,
    x: 82,
    y: 27,
    displayWidth: 24,
    frame: "gold",
    caption: {
      detail: "2019 Best in Show",
    },
  },
  {
    id: "competition-05",
    src: competitionImageSrc(5),
    alt: "A trophy being handed over on the competition floor",
    width: 960,
    height: 640,
    x: 122,
    y: 27.5,
    displayWidth: 19.5,
    frame: "brass",
    caption: {
      kicker: "FROM THE RING",
      title: "Show-day snapshot",
      detail: "Trophy presentation",
    },
  },
  {
    id: "competition-06",
    src: competitionImageSrc(6),
    alt: "Formal studio portrait of Penny with a white poodle",
    width: 418,
    height: 406,
    x: 122,
    y: 76,
    displayWidth: 13,
    frame: "gold",
    caption: {
      kicker: "IN THE STUDIO",
      title: "Teaching",
      detail: "Poodle",
    },
  },
  {
    id: "competition-07",
    src: competitionImageSrc(7),
    alt: "Close-up of a brown poodle being scissored in the studio",
    width: 1460,
    height: 1078,
    x: 160,
    y: 27.5,
    displayWidth: 18.5,
    frame: "brass",
    caption: {
      kicker: "IN THE STUDIO",
      title: "Teaching",
      detail: "Poodle",
    },
  },
  {
    id: "competition-08",
    src: competitionImageSrc(8),
    alt: "Trophy, ribbons, and certificates arranged together on a studio table",
    width: 960,
    height: 720,
    x: 160,
    y: 76.5,
    displayWidth: 18,
    frame: "walnut",
    caption: {
      kicker: "FROM THE ARCHIVE",
      title: "Show-day snapshot",
      detail: "Ribbons and certificates",
    },
  },
];

export const GALLERY_WINNER_ITEM_ID = "competition-04";

export function selectedWorkPlacement(slot: GalleryFrameSlot) {
  const { scale, topShift, bottomShift } = GALLERY_SELECTED_LAYOUT;
  return {
    centerX: slot.centerX,
    centerY: slot.centerY + (slot.centerY < 50 ? topShift : bottomShift),
    displayWidth: slot.displayWidth * scale,
  };
}

export function competitionPlacement(item: CompetitionArchiveItem) {
  const { scale, winnerScale, winnerY, bottomShift } =
    GALLERY_COMPETITION_LAYOUT;
  const isWinner = item.id === GALLERY_WINNER_ITEM_ID;
  return {
    x: item.x,
    y: isWinner ? winnerY : item.y > 50 ? item.y + bottomShift : item.y,
    displayWidth: item.displayWidth * (isWinner ? winnerScale : scale),
  };
}

export function galleryCaptionBox(frame: GalleryBox): GalleryBox {
  const width = frame.right - frame.left;
  const centerX = (frame.left + frame.right) / 2;
  return {
    id: `${frame.id}-caption`,
    left: centerX - width / 2,
    right: centerX + width / 2,
    top: frame.bottom + GALLERY_CAPTION_OFFSET_VH,
    bottom: frame.bottom + GALLERY_CAPTION_OFFSET_VH + GALLERY_CAPTION_HEIGHT_VH,
  };
}

export const SELECTED_WORK_PRIORITY_IDS = new Set([1, 2, 3, 16]);

export const SELECTED_WORK_LIGHTBOX_ITEMS: readonly GalleryLightboxItem[] =
  GALLERY_FRAME_SLOTS.map((slot) => ({
    id: workLightboxId(slot.id),
    src: slot.photoSrc,
    alt: slot.photoAlt,
    width: slot.photoWidth,
    height: slot.photoHeight,
    caption: SELECTED_WORK_CAPTIONS[slot.id],
  }));

export const COMPETITION_LIGHTBOX_ITEMS: readonly GalleryLightboxItem[] =
  COMPETITION_ARCHIVE_ITEMS.map((item) => ({
    id: item.id,
    src: item.src,
    alt: item.alt,
    width: item.width,
    height: item.height,
    caption: item.caption,
  }));

/** Visible gallery wall catalog — selected work only. */
export const GALLERY_LIGHTBOX_ITEMS = SELECTED_WORK_LIGHTBOX_ITEMS;

const ALL_LIGHTBOX_ITEMS: readonly GalleryLightboxItem[] = [
  ...SELECTED_WORK_LIGHTBOX_ITEMS,
  ...COMPETITION_LIGHTBOX_ITEMS,
];

export function getLightboxItem(id: string) {
  return ALL_LIGHTBOX_ITEMS.find((item) => item.id === id);
}

export function lightboxCatalogFor(id: string) {
  if (COMPETITION_LIGHTBOX_ITEMS.some((item) => item.id === id)) {
    return COMPETITION_LIGHTBOX_ITEMS;
  }
  return SELECTED_WORK_LIGHTBOX_ITEMS;
}

export function getLightboxIndex(
  id: string,
  catalog: readonly GalleryLightboxItem[] = lightboxCatalogFor(id),
) {
  return catalog.findIndex((item) => item.id === id);
}

export function nextLightboxId(id: string) {
  const catalog = lightboxCatalogFor(id);
  const index = getLightboxIndex(id, catalog);
  const safe = index < 0 ? 0 : index;
  return catalog[(safe + 1) % catalog.length].id;
}

export function prevLightboxId(id: string) {
  const catalog = lightboxCatalogFor(id);
  const index = getLightboxIndex(id, catalog);
  const safe = index < 0 ? 0 : index;
  return catalog[(safe - 1 + catalog.length) % catalog.length].id;
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

export function lightboxCaptionLines(
  caption?: GalleryCaption,
): readonly [string, string] {
  if (!caption) return ["", ""];
  const primary = [caption.kicker, caption.title].filter(Boolean).join(" · ");
  return [primary, caption.detail ?? ""];
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
  return GALLERY_FRAME_SLOTS.flatMap((slot) => {
    const place = selectedWorkPlacement(slot);
    const frame = galleryArtworkBox({
      id: `work-${slot.id}`,
      centerXVh: place.centerX,
      centerYPercent: place.centerY,
      widthVh: place.displayWidth,
      photoWidth: slot.photoWidth,
      photoHeight: slot.photoHeight,
      viewportVh,
    });
    return [frame, galleryCaptionBox(frame)];
  });
}

export function competitionWallBoxes(viewportVh = GALLERY_VIEWPORT_VH) {
  const frames = COMPETITION_ARCHIVE_ITEMS.flatMap((item) => {
    const place = competitionPlacement(item);
    const frame = galleryArtworkBox({
      id: item.id,
      centerXVh: place.x,
      centerYPercent: place.y,
      widthVh: place.displayWidth,
      photoWidth: item.width,
      photoHeight: item.height,
      viewportVh,
    });
    return [frame, galleryCaptionBox(frame)];
  });
  return frames;
}

export function isOwnCaptionPair(a: GalleryBox, b: GalleryBox) {
  return a.id + "-caption" === b.id || b.id + "-caption" === a.id;
}

export function overlappingGalleryPairs(boxes: readonly GalleryBox[]) {
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      if (isOwnCaptionPair(boxes[i], boxes[j])) continue;
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
  return /\b2014\b|\b2017\b|Best in Group/.test(text);
}
