import type { Metadata } from "next";
import { HomePageContent } from "@/components/home/HomePageContent";
import {
  HOME_PAGE_CANONICAL,
  HOME_PAGE_DESCRIPTION,
  HOME_PAGE_TITLE,
} from "@/lib/home-seo";

export const metadata: Metadata = {
  title: HOME_PAGE_TITLE,
  description: HOME_PAGE_DESCRIPTION,
  openGraph: {
    title: HOME_PAGE_TITLE,
    description: HOME_PAGE_DESCRIPTION,
  },
  twitter: {
    title: HOME_PAGE_TITLE,
    description: HOME_PAGE_DESCRIPTION,
  },
};

export default function HomePage() {
  return (
    <>
      {/* Next resolves a root URL to the origin and drops the trailing slash. */}
      <link rel="canonical" href={HOME_PAGE_CANONICAL} />
      <meta property="og:url" content={HOME_PAGE_CANONICAL} />
      <HomePageContent />
    </>
  );
}
