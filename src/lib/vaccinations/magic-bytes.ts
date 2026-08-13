const PDF_SIGNATURE = Buffer.from("%PDF");

function startsWith(buffer: Buffer, signature: Buffer | number[]) {
  const bytes = Buffer.isBuffer(signature) ? signature : Buffer.from(signature);
  if (buffer.length < bytes.length) return false;
  return buffer.subarray(0, bytes.length).equals(bytes);
}

function readAscii(buffer: Buffer, start: number, length: number) {
  return buffer.subarray(start, start + length).toString("ascii");
}

function isHeicFamily(buffer: Buffer) {
  if (buffer.length < 12) return false;
  if (readAscii(buffer, 4, 4) !== "ftyp") return false;
  const brand = readAscii(buffer, 8, 4);
  return [
    "heic",
    "heix",
    "hevc",
    "hevx",
    "mif1",
    "msf1",
    "heif",
  ].includes(brand);
}

export type DetectedVaccinationMime =
  | "application/pdf"
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/heic"
  | "image/heif";

export function detectVaccinationMimeType(
  buffer: Buffer,
): DetectedVaccinationMime | null {
  if (startsWith(buffer, PDF_SIGNATURE)) return "application/pdf";
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (
    startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    buffer.length >= 12 &&
    readAscii(buffer, 8, 4) === "WEBP"
  ) {
    return "image/webp";
  }
  if (isHeicFamily(buffer)) {
    const brand = readAscii(buffer, 8, 4);
    return brand === "heif" || brand === "mif1" || brand === "msf1"
      ? "image/heif"
      : "image/heic";
  }
  return null;
}

export function extensionForMime(mime: DetectedVaccinationMime) {
  switch (mime) {
    case "application/pdf":
      return "pdf";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
  }
}
