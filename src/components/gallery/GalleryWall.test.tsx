import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GalleryLightbox } from "@/components/gallery/GalleryLightbox";
import { GalleryWall } from "@/components/gallery/GalleryWall";
import {
  GALLERY_WALL_GUIDE_ASSETS,
  SELECTED_WORK_CAPTIONS,
} from "@/lib/gallery-wall";

describe("gallery wall markup", () => {
  it("renders a two-column page instead of a horizontal museum track", () => {
    const html = renderToStaticMarkup(<GalleryWall />);
    assert.match(html, /grid-cols-2/);
    assert.match(html, /grid-rows-subgrid/);
    assert.match(html, /self-center/);
    assert.equal(html.includes("This gallery scrolls horizontally"), false);
    assert.equal(html.includes("Drag to explore"), false);
    assert.equal(html.includes("Grooms by K9 Atelier"), false);
    assert.equal(html.includes("A Study in Coat"), false);
    assert.equal(html.includes("The Craft"), false);
    assert.equal(
      html.includes("Awards, teaching moments, and memories from the show ring."),
      false,
    );
    assert.equal(html.includes("Competition Archive"), false);
    assert.equal(html.includes("Keepsakes"), false);
    assert.equal(html.includes("Teaching notes and show-day snapshots"), false);
    assert.equal(html.includes("Ribbons and notes from the table"), false);
    assert.equal(html.includes("2019 Best in Show"), false);
    assert.equal(html.includes("BEST IN SHOW"), false);
    assert.equal(html.includes("k9-gallery-plaque"), false);
    assert.equal(html.includes("Best in Group"), false);
    assert.equal(html.includes("Credentials"), false);
    assert.match(html, /gallery-01\.png/);
    assert.match(html, /gallery-17\.png/);
    assert.equal(html.includes("gallery-15.png"), false);
    assert.equal(html.includes("competition-04.jpg"), false);
    assert.equal(html.includes("competition-08.jpg"), false);
    assert.equal(html.includes("Trophy presentation"), false);
    assert.equal(html.includes("Group portrait"), false);
    assert.match(html, /k9-gallery-caption-kicker/);
    assert.match(html, /k9-gallery-caption-detail/);
    assert.equal(html.includes("SELECTED WORK"), false);
    assert.match(html, /Asian Fusion/);
    assert.match(html, /Princess look/);
    assert.match(html, /Teddy bear/);
    for (const caption of Object.values(SELECTED_WORK_CAPTIONS)) {
      const pair = `k9-gallery-caption-kicker">${caption.kicker}</span><span class="k9-gallery-caption-detail">${caption.detail}</span>`;
      assert.equal(html.includes(pair), true, `${caption.kicker} / ${caption.detail}`);
    }
    assert.equal(html.includes("columns-2"), false);
    assert.match(html, /k9-gallery-card-caption/);
    for (const src of GALLERY_WALL_GUIDE_ASSETS) {
      assert.equal(html.includes(src), false);
    }
  });

  it("optimizes portfolio frames and preloads only the first row", () => {
    const html = renderToStaticMarkup(<GalleryWall />);
    const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((match) => match[0]);
    assert.equal(imgs.length, 16);
    assert.equal(html.includes("unoptimized"), false);

    const eager = imgs.filter((tag) => !/loading="lazy"/.test(tag));
    const lazy = imgs.filter((tag) => /loading="lazy"/.test(tag));
    assert.equal(eager.length, 2);
    assert.equal(lazy.length, 14);
    assert.match(eager[0] ?? "", /gallery-03\.png/);
    assert.match(eager[1] ?? "", /gallery-04\.png/);
    assert.match(eager[0] ?? "", /fetchpriority="high"/i);
    assert.match(eager[1] ?? "", /fetchpriority="high"/i);
    assert.match(lazy[0] ?? "", /gallery-08\.png/);
    assert.equal(/fetchpriority="high"/i.test(lazy[0] ?? ""), false);

    for (const tag of imgs) {
      assert.match(tag, /\/_next\/image\?url=%2Fimages%2Fgallery%2Fwall%2Fgallery-/);
      assert.match(tag, /srcset="/i);
      assert.match(tag, /sizes="\(max-width: 639px\) calc\(\(100vw - 3rem\) \/ 2\)/);
      assert.match(tag, /width="\d+"/);
      assert.match(tag, /height="\d+"/);
      assert.match(tag, /384w/);
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
    assert.match(html, /2019 Best in Show/);
    assert.equal(html.includes("2019 · Best in Show"), false);
    assert.equal(html.includes(">Bichon<"), false);
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
    assert.equal(html.includes("SELECTED WORK"), false);
    assert.match(html, /Maltese/);
    assert.match(html, /Braided ears/);
  });

  it("uses matching display type on both lightbox caption lines", () => {
    const html = renderToStaticMarkup(
      <GalleryLightbox
        activeId="work-04"
        onActiveIdChange={() => {}}
        onClose={() => {}}
      />,
    );
    assert.match(html, /Poodle/);
    assert.match(html, /Asian Fusion/);
    const caption = html.match(
      /k9-gallery-lightbox-caption">([\s\S]*?)<\/figcaption>/,
    )?.[1];
    assert.ok(caption);
    assert.equal(caption.includes("font-display"), true);
    assert.equal(caption.includes("font-body"), false);
  });
});
