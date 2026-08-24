import { detectVaccinationMimeType } from "@/lib/vaccinations/magic-bytes";
import {
  MAX_SUPPORT_PHOTO_BYTES,
  MAX_SUPPORT_PHOTOS,
} from "@/lib/support-contact";

export type SupportPhotoAttachment = {
  filename: string;
  content: string;
  contentType: string;
};

function sanitizePhotoFilename(name: string, fallback: string) {
  const base = name.split(/[/\\]/).pop()?.trim() ?? fallback;
  const cleaned = base.replace(/[^\w.\-() ]+/g, "_").slice(0, 180);
  return cleaned || fallback;
}

export async function parseSupportPhotos(
  values: FormDataEntryValue[],
): Promise<{ photos: SupportPhotoAttachment[]; error?: string }> {
  const files = values.filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length > MAX_SUPPORT_PHOTOS) {
    return {
      photos: [],
      error: `Please attach up to ${MAX_SUPPORT_PHOTOS} photos.`,
    };
  }

  const photos: SupportPhotoAttachment[] = [];
  for (const [index, file] of files.entries()) {
    if (file.size > MAX_SUPPORT_PHOTO_BYTES) {
      return {
        photos: [],
        error: "Each photo must be 4 MB or smaller.",
      };
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = detectVaccinationMimeType(buffer);
    if (!mime || mime === "application/pdf") {
      return {
        photos: [],
        error: "Photos must be JPG, PNG, WEBP, or HEIC.",
      };
    }
    photos.push({
      filename: sanitizePhotoFilename(file.name, `photo-${index + 1}`),
      content: buffer.toString("base64"),
      contentType: mime,
    });
  }

  return { photos };
}
