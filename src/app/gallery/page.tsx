import type { Metadata } from "next";
import { GalleryPortfolioContext } from "@/components/gallery/GalleryPortfolioContext";
import { GalleryWall } from "@/components/gallery/GalleryWall";
import { PageShell } from "@/components/luxury/PageShell";
import { GalleryJsonLd } from "@/components/seo/GalleryJsonLd";
import {
  GALLERY_PAGE_CANONICAL,
  GALLERY_PAGE_DESCRIPTION,
  GALLERY_PAGE_H1,
  GALLERY_PAGE_INTRO,
  GALLERY_PAGE_TITLE,
} from "@/lib/gallery-page";

export const metadata: Metadata = {
  title: GALLERY_PAGE_TITLE,
  description: GALLERY_PAGE_DESCRIPTION,
  alternates: {
    canonical: GALLERY_PAGE_CANONICAL,
  },
  openGraph: {
    title: GALLERY_PAGE_TITLE,
    description: GALLERY_PAGE_DESCRIPTION,
    url: GALLERY_PAGE_CANONICAL,
  },
  twitter: {
    title: GALLERY_PAGE_TITLE,
    description: GALLERY_PAGE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function GalleryPage() {
  return (
    <>
      <GalleryJsonLd />
      <PageShell eyebrow="The Work" title={GALLERY_PAGE_H1} intro={GALLERY_PAGE_INTRO}>
        <GalleryWall />
        <GalleryPortfolioContext />
      </PageShell>
    </>
  );
}
