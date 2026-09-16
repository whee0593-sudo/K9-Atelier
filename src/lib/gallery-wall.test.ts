import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  COMPETITION_ARCHIVE_ITEMS,
  COMPETITION_LIGHTBOX_ITEMS,
  GALLERY_FRAME_SLOTS,
  GALLERY_LIGHTBOX_ITEMS,
  SELECTED_WORK_LIGHTBOX_ITEMS,
  GALLERY_SECTION_WIDTH_VH,
  GALLERY_WINNER_ITEM_ID,
  competitionWallBoxes,
  competitionPlacement,
  galleryWallPhotoSrc,
  galleryWallPhotoSrcFromWorkId,
  isAwardRésuméCaption,
  isGalleryClick,
  lightboxCaptionLines,
  nextLightboxId,
  overlappingGalleryPairs,
  prevLightboxId,
  selectedWorkBoxes,
  selectedWorkPlacement,
  SELECTED_WORK_CAPTIONS,
  shouldDismissDragHint,
  shouldSuppressArtworkOpen,
} from "./gallery-wall";

describe("gallery wall slots", () => {
  it("maps the framed portraits still hanging on the wall", () => {
    assert.equal(GALLERY_FRAME_SLOTS.length, 16);
    const ids = GALLERY_FRAME_SLOTS.map((slot) => slot.id);
    assert.deepEqual(
      ids,
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17],
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

  it("enlarges wall frames without colliding with neighboring captions", () => {
    for (const slot of GALLERY_FRAME_SLOTS) {
      const place = selectedWorkPlacement(slot);
      assert.ok(place.displayWidth > slot.displayWidth);
      assert.ok(place.displayWidth >= slot.displayWidth * 1.3);
    }
    const boxes = selectedWorkBoxes();
    assert.equal(
      boxes.some((box) => box.id.endsWith("-caption")),
      true,
    );
    assert.deepEqual(overlappingGalleryPairs(boxes), []);
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

  it("hangs all eight photographs on the competition archive wall", () => {
    assert.equal(COMPETITION_ARCHIVE_ITEMS.length, 8);
    assert.equal(
      COMPETITION_ARCHIVE_ITEMS.some((item) => item.id === "competition-08"),
      true,
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

  it("keeps competition frames and captions from overlapping", () => {
    assert.deepEqual(overlappingGalleryPairs(competitionWallBoxes()), []);
  });

  it("enlarges competition frames without colliding with neighboring captions", () => {
    for (const item of COMPETITION_ARCHIVE_ITEMS) {
      const place = competitionPlacement(item);
      assert.ok(place.displayWidth > item.displayWidth);
    }
  });
});

describe("gallery lightbox catalog", () => {
  it("keeps the visible gallery catalog to selected work only", () => {
    assert.equal(GALLERY_LIGHTBOX_ITEMS.length, 16);
    assert.equal(SELECTED_WORK_LIGHTBOX_ITEMS.length, 16);
    assert.equal(GALLERY_LIGHTBOX_ITEMS[0]?.id, "work-01");
    assert.equal(GALLERY_LIGHTBOX_ITEMS[15]?.id, "work-17");
    assert.equal(
      GALLERY_LIGHTBOX_ITEMS.some((item) => item.id === "work-15"),
      false,
    );
    assert.equal(
      GALLERY_LIGHTBOX_ITEMS.some((item) => item.id.startsWith("competition-")),
      false,
    );
    assert.equal(COMPETITION_LIGHTBOX_ITEMS.length, 8);
    assert.equal(COMPETITION_LIGHTBOX_ITEMS[0]?.id, "competition-01");
    assert.equal(COMPETITION_LIGHTBOX_ITEMS[7]?.id, "competition-08");
  });

  it("keeps selected-work lightbox paths mapped to the original PNGs", () => {
    for (const slot of GALLERY_FRAME_SLOTS) {
      const id = `work-${String(slot.id).padStart(2, "0")}`;
      assert.equal(galleryWallPhotoSrcFromWorkId(id), slot.photoSrc);
      const item = GALLERY_LIGHTBOX_ITEMS.find((entry) => entry.id === id);
      assert.equal(item?.src, slot.photoSrc);
    }
  });

  it("cycles selected work and competition catalogs independently", () => {
    assert.equal(nextLightboxId("work-17"), "work-01");
    assert.equal(prevLightboxId("work-01"), "work-17");
    assert.equal(nextLightboxId("competition-07"), "competition-08");
    assert.equal(nextLightboxId("competition-08"), "competition-01");
    assert.equal(prevLightboxId("competition-01"), "competition-08");
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
      detail: "2019 Best in Show",
    });
    assert.deepEqual(lightboxCaptionLines(winner?.caption), [
      "",
      "2019 Best in Show",
    ]);

    for (const item of COMPETITION_ARCHIVE_ITEMS) {
      if (item.id === GALLERY_WINNER_ITEM_ID) continue;
      assert.equal(isAwardRésuméCaption(item.caption), false);
      assert.notEqual(item.caption?.title, "Best in Show");
      assert.notEqual(item.caption?.kicker, "2019");
    }
  });
});

describe("gallery captions", () => {
  it("gives every selected-work portrait a two-line breed + styling label", () => {
    for (const slot of GALLERY_FRAME_SLOTS) {
      const caption = SELECTED_WORK_CAPTIONS[slot.id];
      assert.ok(caption, `missing caption for work ${slot.id}`);
      assert.ok(caption.kicker && caption.kicker.length > 0, slot.id);
      assert.ok(caption.detail && caption.detail.length > 0, slot.id);
      assert.notEqual(caption.kicker, "SELECTED WORK");
      const lines = lightboxCaptionLines(caption);
      assert.equal(lines.length, 2);
      assert.equal(lines[0], caption.kicker);
      assert.equal(lines[1], caption.detail);
    }
  });

  it("gives every selected-work lightbox item a two-line caption", () => {
    assert.equal(GALLERY_LIGHTBOX_ITEMS.length, 16);
    for (const item of GALLERY_LIGHTBOX_ITEMS) {
      assert.ok(item.caption);
      const lines = lightboxCaptionLines(item.caption);
      assert.equal(lines[0].length > 0, true, item.id);
      assert.equal(lines[1].length > 0, true, item.id);
      assert.notEqual(lines[0], "SELECTED WORK");
      assert.notEqual(lines[0], "2019 · Best in Show");
      assert.notEqual(lines[1], "2019 Best in Show");
    }

    const work = GALLERY_LIGHTBOX_ITEMS.find((item) => item.id === "work-01");
    assert.deepEqual(lightboxCaptionLines(work?.caption), [
      "Maltese",
      "Braided ears",
    ]);

    const poodle = GALLERY_LIGHTBOX_ITEMS.find((item) => item.id === "work-04");
    assert.deepEqual(lightboxCaptionLines(poodle?.caption), [
      "Poodle",
      "Asian Fusion",
    ]);
    assert.equal(SELECTED_WORK_CAPTIONS[5]?.detail, "Teddy bear");
    assert.deepEqual(lightboxCaptionLines(SELECTED_WORK_CAPTIONS[3]), [
      "Poodle",
      "Teddy bear",
    ]);
    assert.equal(SELECTED_WORK_CAPTIONS[14]?.detail, "Teddy bear");
    assert.deepEqual(lightboxCaptionLines(SELECTED_WORK_CAPTIONS[16]), [
      "Pomeranian",
      "Boo cut with scarf",
    ]);
    assert.deepEqual(lightboxCaptionLines(SELECTED_WORK_CAPTIONS[11]), [
      "Bichon",
      "Creative Color Dye",
    ]);
    assert.equal(SELECTED_WORK_CAPTIONS[15], undefined);

    const snapshot = COMPETITION_LIGHTBOX_ITEMS.find(
      (item) => item.id === "competition-05",
    );
    assert.deepEqual(lightboxCaptionLines(snapshot?.caption), [
      "FROM THE RING · Show-day snapshot",
      "Trophy presentation",
    ]);
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
