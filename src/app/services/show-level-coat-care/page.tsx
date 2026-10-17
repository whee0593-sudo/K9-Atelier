import type { Metadata } from "next";
import { LongCoatCareJsonLd } from "@/components/seo/LongCoatCareJsonLd";
import { LongCoatCareView } from "@/components/services/LongCoatCareView";
import { ServicesNav } from "@/components/services/ServicesNav";
import {
  LONG_COAT_CARE_CANONICAL,
  LONG_COAT_CARE_PAGE_DESCRIPTION,
  LONG_COAT_CARE_PAGE_TITLE,
} from "@/lib/long-coat-care-page";

export const metadata: Metadata = {
  title: LONG_COAT_CARE_PAGE_TITLE,
  description: LONG_COAT_CARE_PAGE_DESCRIPTION,
  alternates: { canonical: LONG_COAT_CARE_CANONICAL },
  openGraph: {
    title: LONG_COAT_CARE_PAGE_TITLE,
    description: LONG_COAT_CARE_PAGE_DESCRIPTION,
    url: LONG_COAT_CARE_CANONICAL,
  },
  twitter: {
    title: LONG_COAT_CARE_PAGE_TITLE,
    description: LONG_COAT_CARE_PAGE_DESCRIPTION,
  },
};

export default function LongCoatCarePage() {
  return (
    <>
      <LongCoatCareJsonLd />
      <ServicesNav />
      <LongCoatCareView />
    </>
  );
}
