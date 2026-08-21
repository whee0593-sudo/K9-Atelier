import galleryData from "../../content/gallery.json";

export type PhotoPlacement =
  | "hero"
  | "artistry"
  | "about"
  | "salon"
  | "gallery";

export type GalleryPhoto = {
  id: string;
  src: string;
  alt: string;
  caption: string;
  placements: PhotoPlacement[];
};

export const galleryPhotos = galleryData.photos as GalleryPhoto[];

export function photosFor(placement: PhotoPlacement): GalleryPhoto[] {
  return galleryPhotos.filter((photo) => photo.placements.includes(placement));
}

export function photoFor(placement: PhotoPlacement): GalleryPhoto | undefined {
  return photosFor(placement)[0];
}
