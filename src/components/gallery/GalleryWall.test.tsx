import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GalleryLightbox } from "@/components/gallery/GalleryLightbox";
import { GalleryWall } from "@/components/gallery/GalleryWall";
import { GALLERY_WALL_GUIDE_ASSETS } from "@/lib/gallery-wall";

describe("gallery wall markup", () => {
  it("renders one horizontal museum track instead of masonry", () => {
    const html = renderToStaticMarkup(<GalleryWall />);
    assert.match(html, /The Work/);
    assert.match(html, /Selected work by K9 Atelier/);
    assert.equal(html.includes("Grooms by K9 Atelier"), false);
    assert.equal(html.includes("A Study in Coat"), false);
    assert.match(html, /The Craft/);
    assert.match(html, /Awards, teaching moments, and memories from the show ring\./);
    assert.equal(html.includes("Competition Archive"), false);
    assert.match(html, /This gallery scrolls horizontally/);
    assert.match(html, /Drag to explore/);
    assert.equal(html.includes("Keepsakes"), false);
    assert.equal(html.includes("Teaching notes and show-day snapshots"), false);
    assert.equal(html.includes("Ribbons and notes from the table"), false);
    assert.match(html, /2019/);
    assert.match(html, /BEST IN SHOW/);
    assert.match(html, /Bichon/);
    assert.equal(html.includes("Best in Group"), false);
    assert.equal(html.includes("Pomeranian"), false);
    assert.equal(html.includes("Credentials"), false);
    assert.match(html, /gallery-01\.png/);
    assert.match(html, /gallery-17\.png/);
    assert.match(html, /competition-04\.jpg/);
    assert.match(html, /competition-08\.jpg/);
    assert.equal(html.includes("SELECTED WORK"), false);
    assert.equal(html.includes("k9-gallery-caption-kicker"), false);
    assert.match(html, /Braided ears/);
    assert.equal(html.includes("FROM THE RING"), false);
    assert.equal(html.includes("IN THE STUDIO"), false);
    assert.equal(html.includes("FROM THE ARCHIVE"), false);
    assert.match(html, /Trophy presentation/);
    assert.match(html, /Group portrait/);
    assert.equal(html.includes("columns-2"), false);
    for (const src of GALLERY_WALL_GUIDE_ASSETS) {
      assert.equal(html.includes(src), false);
    }
  });
});

describe("gallery lightbox markup", () => {
  it("exposes dialog semantics and the 2019 winner caption", () => {
    const html = renderToStaticMarkup(
      <GalleryLightbox
        activeId="competition-04"
        onActiveIdChange={() => {}}
        onClose={() => {}}
      />,
    );
    assert.match(html, /role="dialog"/);
    assert.match(html, /aria-modal="true"/);
    assert.match(html, /2019 · Best in Show/);
    assert.match(html, /Bichon/);
    assert.match(html, /k9-gallery-lightbox-caption/);
    assert.match(html, /Previous image/);
    assert.match(html, /Next image/);
  });

  it("shows the same two-line caption area for selected work", () => {
    const html = renderToStaticMarkup(
      <GalleryLightbox
        activeId="work-01"
        onActiveIdChange={() => {}}
        onClose={() => {}}
      />,
    );
    assert.equal(html.includes("2019 · Best in Show"), false);
    assert.match(html, /gallery-01\.png/);
    assert.match(html, /k9-gallery-lightbox-caption/);
    assert.match(html, /SELECTED WORK/);
    assert.match(html, /Braided ears/);
  });
});
