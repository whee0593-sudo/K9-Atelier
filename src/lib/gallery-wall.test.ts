import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GALLERY_FRAME_SLOTS,
  galleryWallPhotoSrc,
} from "./gallery-wall";

describe("gallery wall slots", () => {
  it("maps all 17 framed portraits from 1 to 01 through 17 to 17", () => {
    assert.equal(GALLERY_FRAME_SLOTS.length, 17);
    const ids = GALLERY_FRAME_SLOTS.map((slot) => slot.id);
    assert.deepEqual(
      ids,
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
    );

    for (const slot of GALLERY_FRAME_SLOTS) {
      assert.equal(slot.photoSrc, galleryWallPhotoSrc(slot.id));
      assert.equal(slot.fit, "framed");
      assert.ok(slot.centerX > 0 && slot.centerX < 100);
      assert.ok(slot.centerY > 0 && slot.centerY < 100);
      assert.ok(slot.displayWidth > 0);
      assert.ok(slot.photoAlt.length > 20);
      assert.match(slot.photoAlt, /K9 Atelier grooming portfolio/);
      assert.ok(slot.photoWidth > 0);
      assert.ok(slot.photoHeight > 0);
    }
  });
});
