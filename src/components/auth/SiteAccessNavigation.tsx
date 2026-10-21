import React from "react";
import Link from "next/link";
import { ExitPreviewButton } from "@/components/auth/ExitPreviewButton";

export function SiteAccessNavigation({ privacyMode }: { privacyMode: boolean }) {
  return privacyMode ? (
    <ExitPreviewButton />
  ) : (
    <Link href="/" className="underline hover:text-gold-dark">View website</Link>
  );
}
