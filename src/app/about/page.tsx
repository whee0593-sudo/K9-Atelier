import type { Metadata } from "next";
import { AboutStory } from "@/components/about/AboutStory";
import { AboutJsonLd } from "@/components/seo/AboutJsonLd";
import {
  ABOUT_PAGE_CANONICAL,
  ABOUT_PAGE_DESCRIPTION,
  ABOUT_PAGE_TITLE,
} from "@/lib/about-page";

export const metadata: Metadata = {
  title: ABOUT_PAGE_TITLE,
  description: ABOUT_PAGE_DESCRIPTION,
  alternates: {
    canonical: ABOUT_PAGE_CANONICAL,
  },
  openGraph: {
    title: ABOUT_PAGE_TITLE,
    description: ABOUT_PAGE_DESCRIPTION,
    url: ABOUT_PAGE_CANONICAL,
  },
  twitter: {
    title: ABOUT_PAGE_TITLE,
    description: ABOUT_PAGE_DESCRIPTION,
  },
};

export default function AboutPage() {
  return (
    <>
      <AboutJsonLd />
      <AboutStory />
    </>
  );
}
