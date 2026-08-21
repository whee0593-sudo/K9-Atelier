import { HomeAboutTeaser } from "./HomeAboutTeaser";
import { HomeArtistry } from "./HomeArtistry";
import { HomeBookingCta } from "./HomeBookingCta";
import { HomeExperience } from "./HomeExperience";
import { HomeExpertise } from "./HomeExpertise";
import { HomeFaqTeaser } from "./HomeFaqTeaser";
import { HomeGentleCare } from "./HomeGentleCare";
import { HomeHero } from "./HomeHero";
import { HomeMobileSalon } from "./HomeMobileSalon";
import { HomeReviews } from "./HomeReviews";
import { HomeSignatureServices } from "./HomeSignatureServices";
import { HomeSpaWellness } from "./HomeSpaWellness";

export function HomePageContent() {
  return (
    <>
      <HomeHero />
      <HomeExperience />
      <HomeExpertise />
      <HomeSignatureServices />
      <HomeMobileSalon />
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
