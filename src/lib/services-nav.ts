/** Category routes and old hash redirects. No catalog prices. */

export const SERVICES_PATH = "/services";
export const FULL_GROOM_PATH = "/services/full-groom";
export const HAND_STRIPPING_PATH = "/services/hand-stripping";
export const BATH_COAT_PATH = "/services/bath-coat-care";
export const SPA_PATH = "/services/spa";
export const COLOR_PATH = "/services/color";
export const SPECIALTY_CARE_PATH = "/services/specialty-care";
export const ADD_ONS_PATH = "/services/add-ons";
export const FEES_POLICIES_PATH = "/faq#fees-policies";
export const CONSULTATION_PATH = "/contact?inquiry=grooming-consultation";

export const SERVICES_NAV = [
  { href: BATH_COAT_PATH, sectionId: "bath-coat-care", label: "Bath & Coat" },
  { href: FULL_GROOM_PATH, sectionId: "full-groom", label: "Full Grooming" },
  { href: HAND_STRIPPING_PATH, sectionId: "hand-stripping", label: "Hand Stripping" },
  { href: SPA_PATH, sectionId: "spa", label: "Luxury Spa Day" },
  { href: COLOR_PATH, sectionId: "color", label: "Creative Color" },
  { href: SPECIALTY_CARE_PATH, sectionId: "specialty-care", label: "Specialty Care" },
  { href: ADD_ONS_PATH, sectionId: "add-ons", label: "Add-On Care" },
] as const;

/** Old in-page hashes that now have dedicated category or FAQ routes. */
export const SERVICES_HASH_ROUTES: Record<string, string> = {
  "most-requested": SERVICES_PATH,
  "bath-coat": BATH_COAT_PATH,
  "signature-bath": BATH_COAT_PATH,
  "full-groom": FULL_GROOM_PATH,
  "atelier-full-groom": FULL_GROOM_PATH,
  "hand-stripping": HAND_STRIPPING_PATH,
  "spa-rituals": SPA_PATH,
  "spa-wellness": SPA_PATH,
  "color-dye": COLOR_PATH,
  "specialty-care": SPECIALTY_CARE_PATH,
  "gentle-care": SPECIALTY_CARE_PATH,
  "add-ons": ADD_ONS_PATH,
  "fees-policies": FEES_POLICIES_PATH,
};
