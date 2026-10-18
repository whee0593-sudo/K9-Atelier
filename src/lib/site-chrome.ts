import {
  business,
  getBrandInstagramUrl,
  getBrandPhoneTelHref,
  getBrandSearchName,
  getGoogleWriteReviewUrl,
} from "@/lib/business";

/** Plain header and footer fields. Do not import this module from a client component. */
export type SiteChrome = {
  logo: string;
  name: string;
  searchName: string;
  phone: string;
  phoneDisplay: string;
  phoneHref: string | null;
  instagramUrl: string;
  facebookUrl: string;
  facebookLabel: string;
  googleReviewUrl: string | null;
  daysLabel: string;
  hoursLabel: string;
};

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatTime(value: string) {
  const [hStr, mStr] = value.split(":");
  const hour = Number(hStr);
  const minute = mStr ?? "00";
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute} ${period}`;
}

export function getSiteChrome(): SiteChrome {
  const { brand, booking } = business;
  const days = booking.availableDays;
  const daysLabel =
    days.length > 1
      ? `${capitalize(days[0])}–${capitalize(days[days.length - 1])}`
      : capitalize(days[0] ?? "");

  return {
    logo: brand.logo,
    name: brand.name,
    searchName: getBrandSearchName(),
    phone: brand.phone,
    phoneDisplay: brand.phoneDisplay || brand.phone,
    phoneHref: getBrandPhoneTelHref(),
    instagramUrl: getBrandInstagramUrl() ?? "https://instagram.com/k9atelierfl",
    facebookUrl: brand.social.facebookUrl,
    facebookLabel: brand.social.facebook,
    googleReviewUrl: getGoogleWriteReviewUrl(),
    daysLabel,
    hoursLabel: `${formatTime(booking.hoursStart)}–${formatTime(booking.hoursEnd)}`,
  };
}
