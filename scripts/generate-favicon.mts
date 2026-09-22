/**
 * Rebuild browser-tab / PWA icons from the official circular logo.
 *
 *   npm install --no-save sharp
 *   npx --yes tsx scripts/generate-favicon.mts
 *
 * Replace public/logo.png first if the mark itself changed.
 *
 * Large icons keep the full circular badge. 16–48px tab icons crop in on
 * the two dogs so the faces stay readable at favicon size.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const logoPath = join(root, "public", "logo.png");

/** Tight square around the two dog faces on the 1024×1024 logo. */
const FACE_CROP = { left: 112, top: 156, width: 800, height: 800 };

async function png(size: number, cropFaces = false): Promise<Buffer> {
  let pipeline = sharp(logoPath).rotate();
  if (cropFaces) {
    pipeline = pipeline.extract(FACE_CROP);
  }
  return pipeline
    .resize(size, size, {
      fit: "cover",
      position: "centre",
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

function icoFromPngs(images: { size: number; png: Buffer }[]): Buffer {
  const count = images.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const entries: Buffer[] = [];
  const payloads: Buffer[] = [];

  for (const image of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(image.size >= 256 ? 0 : image.size, 0);
    entry.writeUInt8(image.size >= 256 ? 0 : image.size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(image.png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    payloads.push(image.png);
    offset += image.png.length;
  }

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  return Buffer.concat([header, ...entries, ...payloads]);
}

const sizes = {
  icon: 256,
  apple: 180,
  chrome192: 192,
  chrome512: 512,
} as const;

const [icon, apple, chrome192, chrome512, ico16, ico32, ico48] = await Promise.all([
  png(sizes.icon),
  png(sizes.apple),
  png(sizes.chrome192),
  png(sizes.chrome512),
  png(16, true),
  png(32, true),
  png(48, true),
]);

writeFileSync(join(root, "src/app/icon.png"), icon);
writeFileSync(join(root, "src/app/apple-icon.png"), apple);
writeFileSync(join(root, "public/android-chrome-192x192.png"), chrome192);
writeFileSync(join(root, "public/android-chrome-512x512.png"), chrome512);
writeFileSync(join(root, "public/favicon-32x32.png"), ico32);
writeFileSync(
  join(root, "public/favicon.ico"),
  icoFromPngs([
    { size: 16, png: ico16 },
    { size: 32, png: ico32 },
    { size: 48, png: ico48 },
  ]),
);

console.log(
  "Wrote favicon.ico, favicon-32x32.png, icon.png, apple-icon.png, and Android chrome icons from public/logo.png",
);
