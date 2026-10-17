export const SHOW_LEVEL_COAT_CARE_PATH = "/services/show-level-coat-care";
export const LEGACY_LONG_COAT_CARE_PATH = "/services/long-coat-care";

export const PERMANENT_REDIRECTS = [
  {
    source: LEGACY_LONG_COAT_CARE_PATH,
    destination: SHOW_LEVEL_COAT_CARE_PATH,
    statusCode: 301 as const,
  },
];
