import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectVaccinationMimeType } from "@/lib/vaccinations/magic-bytes";

describe("detectVaccinationMimeType", () => {
  it("detects PDF files", () => {
    const buffer = Buffer.from("%PDF-1.7");
    assert.equal(detectVaccinationMimeType(buffer), "application/pdf");
  });

  it("detects JPEG files", () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    assert.equal(detectVaccinationMimeType(buffer), "image/jpeg");
  });

  it("detects PNG files", () => {
    const buffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]);
    assert.equal(detectVaccinationMimeType(buffer), "image/png");
  });

  it("detects WEBP files", () => {
    const buffer = Buffer.concat([
      Buffer.from("RIFF"),
      Buffer.alloc(4),
      Buffer.from("WEBP"),
    ]);
    assert.equal(detectVaccinationMimeType(buffer), "image/webp");
  });

  it("rejects unknown files", () => {
    assert.equal(detectVaccinationMimeType(Buffer.from("hello")), null);
  });
});
