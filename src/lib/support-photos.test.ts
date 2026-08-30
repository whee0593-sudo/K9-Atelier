import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSupportPhotos } from "./support-photos";

function jpegFile(name = "dog.jpg") {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  return new File([bytes], name, { type: "image/jpeg" });
}

describe("parseSupportPhotos", () => {
  it("turns uploaded images into Resend attachments", async () => {
    const result = await parseSupportPhotos([jpegFile("face.jpg")]);
    assert.equal(result.error, undefined);
    assert.equal(result.photos.length, 1);
    assert.equal(result.photos[0]?.filename, "face.jpg");
    assert.equal(result.photos[0]?.contentType, "image/jpeg");
    assert.ok(result.photos[0]?.content.length);
  });

  it("rejects more than five photos", async () => {
    const files = Array.from({ length: 6 }, (_, index) =>
      jpegFile(`dog-${index + 1}.jpg`),
    );
    const result = await parseSupportPhotos(files);
    assert.equal(result.photos.length, 0);
    assert.match(result.error ?? "", /up to 5 photos/i);
  });

  it("rejects files that are not photos", async () => {
    const pdf = new File([Buffer.from("%PDF-1.7")], "notes.pdf", {
      type: "application/pdf",
    });
    const result = await parseSupportPhotos([pdf]);
    assert.equal(result.photos.length, 0);
    assert.match(result.error ?? "", /JPG, JPEG, PNG, or WEBP/i);
  });
});
