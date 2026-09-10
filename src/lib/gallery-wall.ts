/**
 * Museum gallery wall.
 * Each framed PNG is centered on its matching number on the wall image.
 * Photos are not cropped, masked, or rewritten.
 * Wall portraits are transparent-background framed PNGs so the museum wall shows through.
 */

export const GALLERY_WALL = {
  src: "/images/gallery/museum-wall-numbered.jpg",
  width: 1024,
  height: 682,
  /** Deep forest / olive-black sampled from the wall edges. */
  background: "#11120a",
  alt: "Dark museum gallery wall with warm ceiling lights, dark wood trim, a wood floor, and a patterned rug",
} as const;

export type GalleryFrameSlot = {
  id: number;
  /** Number center as a percent of the wall image (0–100). */
  centerX: number;
  centerY: number;
  /** Display width as a percent of the wall width. Height follows the PNG ratio. */
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
 * Number centers measured on museum-wall-numbered.jpg.
 * gallery-01 sits on 1, gallery-02 on 2, through gallery-17 on 17.
 */
export const GALLERY_FRAME_SLOTS: readonly GalleryFrameSlot[] = [
  {
    id: 1,
    centerX: 14.15,
    centerY: 37.79,
    displayWidth: 16.5,
    photoSrc: galleryWallPhotoSrc(1),
    photoAlt:
      "K9 Atelier grooming portfolio — white dog with braided ears in an ornate oval gold frame",
    photoWidth: 1024,
    photoHeight: 1536,
    fit: "framed",
  },
  {
    id: 2,
    centerX: 28.64,
    centerY: 24.54,
    displayWidth: 10.2,
    photoSrc: galleryWallPhotoSrc(2),
    photoAlt:
      "K9 Atelier grooming portfolio — Yorkshire Terrier in a paisley bandana, ornate gold frame",
    photoWidth: 1430,
    photoHeight: 1100,
    fit: "framed",
  },
  {
    id: 3,
    centerX: 29.4,
    centerY: 45.4,
    displayWidth: 10.8,
    photoSrc: galleryWallPhotoSrc(3),
    photoAlt:
      "K9 Atelier grooming portfolio — cream bichon-style portrait in an ornate gold frame",
    photoWidth: 1141,
    photoHeight: 1378,
    fit: "framed",
  },
  {
    id: 4,
    centerX: 43.05,
    centerY: 25.76,
    displayWidth: 13.8,
    photoSrc: galleryWallPhotoSrc(4),
    photoAlt:
      "K9 Atelier grooming portfolio — chocolate-and-white poodle with a floral ribbon, ornate gold frame",
    photoWidth: 1119,
    photoHeight: 1405,
    fit: "framed",
  },
  {
    id: 5,
    centerX: 65.11,
    centerY: 26.69,
    displayWidth: 13.8,
    photoSrc: galleryWallPhotoSrc(5),
    photoAlt:
      "K9 Atelier grooming portfolio — white bichon in a red knit scarf, ornate gold frame",
    photoWidth: 1120,
    photoHeight: 1404,
    fit: "framed",
  },
  {
    id: 6,
    centerX: 80.88,
    centerY: 27.28,
    displayWidth: 12.2,
    photoSrc: galleryWallPhotoSrc(6),
    photoAlt:
      "K9 Atelier grooming portfolio — Yorkshire Terrier with a top knot in an ornate oval gold frame",
    photoWidth: 1141,
    photoHeight: 1378,
    fit: "framed",
  },
  {
    id: 7,
    centerX: 92.5,
    centerY: 26.08,
    displayWidth: 9.4,
    photoSrc: galleryWallPhotoSrc(7),
    photoAlt:
      "K9 Atelier grooming portfolio — white dog with creative color accents in an ornate gold frame",
    photoWidth: 1403,
    photoHeight: 1121,
    fit: "framed",
  },
  {
    id: 8,
    centerX: 39.08,
    centerY: 46.47,
    displayWidth: 8.8,
    photoSrc: galleryWallPhotoSrc(8),
    photoAlt:
      "K9 Atelier grooming portfolio — apricot poodle in profile, ornate gold frame",
    photoWidth: 1329,
    photoHeight: 1183,
    fit: "framed",
  },
  {
    id: 9,
    centerX: 48.51,
    centerY: 46.25,
    displayWidth: 8.6,
    photoSrc: galleryWallPhotoSrc(9),
    photoAlt:
      "K9 Atelier grooming portfolio — white-and-tan dog in a red polka-dot bandana, ornate gold frame",
    photoWidth: 1098,
    photoHeight: 1433,
    fit: "framed",
  },
  {
    id: 10,
    centerX: 43.84,
    centerY: 68.23,
    displayWidth: 14.2,
    photoSrc: galleryWallPhotoSrc(10),
    photoAlt:
      "K9 Atelier grooming portfolio — white-and-brown dog with pigtails in an ornate gold frame",
    photoWidth: 1374,
    photoHeight: 1145,
    fit: "framed",
  },
  {
    id: 11,
    centerX: 64.25,
    centerY: 53.13,
    displayWidth: 13.0,
    photoSrc: galleryWallPhotoSrc(11),
    photoAlt:
      "K9 Atelier grooming portfolio — white dog with rainbow creative color, ornate gold frame",
    photoWidth: 1550,
    photoHeight: 1014,
    fit: "framed",
  },
  {
    id: 12,
    centerX: 79.71,
    centerY: 54.79,
    displayWidth: 11.2,
    photoSrc: galleryWallPhotoSrc(12),
    photoAlt:
      "K9 Atelier grooming portfolio — cream-and-silver terrier in an ornate gold frame",
    photoWidth: 1215,
    photoHeight: 1295,
    fit: "framed",
  },
  {
    id: 13,
    centerX: 93.18,
    centerY: 51.94,
    displayWidth: 9.6,
    photoSrc: galleryWallPhotoSrc(13),
    photoAlt:
      "K9 Atelier grooming portfolio — honey-coated doodle in an ornate gold frame",
    photoWidth: 1024,
    photoHeight: 1536,
    fit: "framed",
  },
  {
    id: 14,
    centerX: 90.11,
    centerY: 75.6,
    displayWidth: 8.8,
    photoSrc: galleryWallPhotoSrc(14),
    photoAlt:
      "K9 Atelier grooming portfolio — apricot poodle standing in profile, ornate gold frame",
    photoWidth: 1374,
    photoHeight: 1145,
    fit: "framed",
  },
  {
    id: 15,
    centerX: 11.27,
    centerY: 72.46,
    displayWidth: 9.0,
    photoSrc: galleryWallPhotoSrc(15),
    photoAlt:
      "K9 Atelier grooming portfolio — brown-and-white poodle with a floral accent, ornate gold frame",
    photoWidth: 1119,
    photoHeight: 1405,
    fit: "framed",
  },
  {
    id: 16,
    centerX: 26.04,
    centerY: 70.19,
    displayWidth: 10.2,
    photoSrc: galleryWallPhotoSrc(16),
    photoAlt:
      "K9 Atelier grooming portfolio — plush white dog in an ornate oval gold frame",
    photoWidth: 1024,
    photoHeight: 1536,
    fit: "framed",
  },
  {
    id: 17,
    centerX: 65.44,
    centerY: 73.97,
    displayWidth: 11.0,
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
