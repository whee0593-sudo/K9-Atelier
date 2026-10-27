import React from "react";
import { HomeBookingCta } from "./HomeBookingCta";
import { HomeFirstVisit } from "./HomeFirstVisit";
import { HomeHero } from "./HomeHero";
import { HomeSelectedWork } from "./HomeSelectedWork";
import { HomeServices } from "./HomeServices";

export function HomePageContent({ showPrices = false }: { showPrices?: boolean }) {
  return (
    <div className="bg-[#FAF7F2] text-[#302D33] [--color-ivory:#FAF7F2] [--color-ink:#302D33] [--color-deep-lavender:#513562] [--color-dusty-lavender:#EEE7F3] [--color-champagne:#735783] [&_h1]:text-[#382440] [&_h2]:text-[#382440] [&_h3]:text-[#382440]">
      <HomeHero />
      <HomeServices showPrices={showPrices} />
      <HomeSelectedWork />
      <HomeFirstVisit />
      <HomeBookingCta />
    </div>
  );
}
