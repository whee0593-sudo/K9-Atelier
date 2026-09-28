import type { Metadata } from "next";
import { HomePageContent } from "@/components/home/HomePageContent";

export const HOME_PAGE_TITLE =
  "Mobile Dog Grooming in Palm Beach | K9 Atelier";
export const HOME_PAGE_DESCRIPTION =
  "Private mobile dog grooming in Palm Beach by a multiple award-winning show groomer, specializing in tailored styling, coat care, senior care and hand stripping.";
export const HOME_PAGE_CANONICAL = "https://k9atelier.com/";

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
