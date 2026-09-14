import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  COMPETITION_ARCHIVE_ITEMS,
  CREDENTIALS_ITEMS,
  GALLERY_FRAME_SLOTS,
  GALLERY_LIGHTBOX_ITEMS,
  GALLERY_SECTION_WIDTH_VH,
  GALLERY_WINNER_ITEM_ID,
  competitionWallBoxes,
  galleryWallPhotoSrc,
  galleryWallPhotoSrcFromWorkId,
  isAwardRésuméCaption,
  isGalleryClick,
  lightboxCaptionLines,
  nextLightboxId,
  overlappingGalleryPairs,
  prevLightboxId,
  selectedWorkBoxes,
  shouldDismissDragHint,
  shouldSuppressArtworkOpen,
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
      assert.ok(slot.centerX > 0);
      assert.ok(slot.centerX < GALLERY_SECTION_WIDTH_VH.selected);
      assert.ok(slot.centerY > 0 && slot.centerY < 100);
      assert.ok(slot.displayWidth > 0);
      assert.ok(slot.photoAlt.length > 20);
      assert.match(slot.photoAlt, /K9 Atelier grooming portfolio/);
      assert.ok(slot.photoWidth > 0);
      assert.ok(slot.photoHeight > 0);
    }
  });

  it("keeps selected-work frames from overlapping, including hover scale", () => {
    assert.deepEqual(overlappingGalleryPairs(selectedWorkBoxes()), []);
  });
});

describe("competition archive data", () => {
  it("contains eight unique competition photographs", () => {
    assert.equal(COMPETITION_ARCHIVE_ITEMS.length, 8);
    const ids = COMPETITION_ARCHIVE_ITEMS.map((item) => item.id);
    assert.deepEqual(ids, [
      "competition-01",
      "competition-02",
      "competition-03",
      "competition-04",
      "competition-05",
      "competition-06",
      "competition-07",
      "competition-08",
    ]);
    assert.equal(new Set(ids).size, 8);
  });

  it("keeps competition-08 in keepsakes, not the main archive wall", () => {
    const credentials = COMPETITION_ARCHIVE_ITEMS.find(
      (item) => item.id === "competition-08",
    );
    assert.equal(credentials?.section, "credentials");
    assert.deepEqual(
      CREDENTIALS_ITEMS.map((item) => item.id),
      ["competition-08"],
    );
    assert.equal(
      COMPETITION_ARCHIVE_ITEMS.filter((item) => item.section === "competition")
        .length,
      7,
    );
  });

  it("points every archive item at a real JPEG in public/", () => {
    for (const [index, item] of COMPETITION_ARCHIVE_ITEMS.entries()) {
      const n = String(index + 1).padStart(2, "0");
      assert.equal(
        item.src,
        `/images/gallery/competition/competition-${n}.jpg`,
      );
      const file = path.join(process.cwd(), "public", item.src.slice(1));
      assert.equal(fs.existsSync(file), true, file);
    }
  });

  it("keeps competition frames and the 2019 plaque from overlapping", () => {
    assert.deepEqual(overlappingGalleryPairs(competitionWallBoxes()), []);
  });
});

describe("unified lightbox catalog", () => {
  it("combines selected work and competition images into 25 items", () => {
    assert.equal(GALLERY_LIGHTBOX_ITEMS.length, 25);
    assert.equal(GALLERY_LIGHTBOX_ITEMS[0]?.id, "work-01");
    assert.equal(GALLERY_LIGHTBOX_ITEMS[16]?.id, "work-17");
    assert.equal(GALLERY_LIGHTBOX_ITEMS[17]?.id, "competition-01");
    assert.equal(GALLERY_LIGHTBOX_ITEMS[23]?.id, "competition-07");
    assert.equal(GALLERY_LIGHTBOX_ITEMS[24]?.id, "competition-08");
  });

  it("keeps selected-work lightbox paths mapped to the original PNGs", () => {
    for (const slot of GALLERY_FRAME_SLOTS) {
      const id = `work-${String(slot.id).padStart(2, "0")}`;
      assert.equal(galleryWallPhotoSrcFromWorkId(id), slot.photoSrc);
      const item = GALLERY_LIGHTBOX_ITEMS.find((entry) => entry.id === id);
      assert.equal(item?.src, slot.photoSrc);
    }
  });

  it("navigates across the work-17 and competition-01 boundary", () => {
    assert.equal(nextLightboxId("work-17"), "competition-01");
    assert.equal(prevLightboxId("competition-01"), "work-17");
    assert.equal(nextLightboxId("competition-07"), "competition-08");
    assert.equal(nextLightboxId("competition-08"), "work-01");
    assert.equal(prevLightboxId("work-01"), "competition-08");
  });
});

describe("2019 winner metadata", () => {
  it("keeps Best in Show only on the 2019 winner image", () => {
    const winner = COMPETITION_ARCHIVE_ITEMS.find(
      (item) => item.id === GALLERY_WINNER_ITEM_ID,
    );
    assert.equal(winner?.id, "competition-04");
    assert.equal(winner?.width, 960);
    assert.equal(winner?.height, 801);
    assert.deepEqual(winner?.caption, {
      kicker: "2019",
      title: "Best in Show",
      detail: "Bichon",
    });
    assert.deepEqual(lightboxCaptionLines(winner?.caption), [
      "2019 · Best in Show",
      "Bichon",
    ]);

    for (const item of COMPETITION_ARCHIVE_ITEMS) {
      if (item.id === GALLERY_WINNER_ITEM_ID) continue;
      assert.equal(isAwardRésuméCaption(item.caption), false);
      assert.notEqual(item.caption?.title, "Best in Show");
      assert.notEqual(item.caption?.kicker, "2019");
    }
  });
});

describe("drag versus click", () => {
  it("treats movement under five pixels as a click", () => {
    assert.equal(isGalleryClick(0), true);
    assert.equal(isGalleryClick(4.9), true);
    assert.equal(shouldSuppressArtworkOpen(4.9), false);
  });

  it("suppresses lightbox open after a drag past the threshold", () => {
    assert.equal(isGalleryClick(5), false);
    assert.equal(shouldSuppressArtworkOpen(5), true);
    assert.equal(shouldSuppressArtworkOpen(24), true);
    assert.equal(shouldDismissDragHint(16), true);
    assert.equal(shouldDismissDragHint(15), false);
  });
});
