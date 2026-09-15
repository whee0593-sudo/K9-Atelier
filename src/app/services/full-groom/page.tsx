import type { Metadata } from "next";
import { FullGroomSection } from "@/components/services/FullGroomSection";
import { MobileBookBar } from "@/components/services/MobileBookBar";
import { ServicesNav } from "@/components/services/ServicesNav";
import {
  FULL_GROOM_PAGE_DESCRIPTION,
  FULL_GROOM_PAGE_TITLE,
  FULL_GROOM_PATH,
  absoluteSiteUrl,
} from "@/lib/service-page";

const canonical = absoluteSiteUrl(FULL_GROOM_PATH);

export const metadata: Metadata = {
  title: FULL_GROOM_PAGE_TITLE,
  description: FULL_GROOM_PAGE_DESCRIPTION,
  alternates: {
    canonical,
  },
  openGraph: {
    title: FULL_GROOM_PAGE_TITLE,
    description: FULL_GROOM_PAGE_DESCRIPTION,
    url: canonical,
  },
};

export default function FullGroomPage() {
  return (
    <div className="pb-24 md:pb-0">
      <ServicesNav />
      <FullGroomSection variant="page" />
      <MobileBookBar />
    </div>
  );
}
