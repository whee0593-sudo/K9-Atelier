import { HomeAboutTeaser } from "./HomeAboutTeaser";
import { HomeArtistry } from "./HomeArtistry";
import { HomeBookingCta } from "./HomeBookingCta";
import { HomeExpertise } from "./HomeExpertise";
import { HomeFaqTeaser } from "./HomeFaqTeaser";
import { HomeFirstVisit } from "./HomeFirstVisit";
import { HomeGentleCare } from "./HomeGentleCare";
import { HomeHero } from "./HomeHero";
import { HomeReviews } from "./HomeReviews";
import { HomeSignatureServices } from "./HomeSignatureServices";
import { HomeSpaWellness } from "./HomeSpaWellness";

export function HomePageContent() {
  return (
    <>
      <HomeHero />
      <HomeExpertise />
      <HomeSignatureServices />
      <HomeFirstVisit />
      <HomeSpaWellness />
      <HomeArtistry />
      <HomeReviews />
      <HomeGentleCare />
      <HomeAboutTeaser />
      <HomeBookingCta />
      <HomeFaqTeaser />
    </>
  );
}
