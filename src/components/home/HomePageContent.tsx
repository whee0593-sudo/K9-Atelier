import React from "react";
import { HomeFirstVisit } from "./HomeFirstVisit";
import { HomeHero } from "./HomeHero";
import { HomeSelectedWork } from "./HomeSelectedWork";
import { HomeServices } from "./HomeServices";

export function HomePageContent({ showPrices = false }: { showPrices?: boolean }) {
  return (
    <>
      <HomeHero />
      <HomeServices showPrices={showPrices} />
      <HomeSelectedWork />
      <HomeFirstVisit />
    </>
  );
}
