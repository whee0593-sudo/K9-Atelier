export const customerPaymentMethodOrder = [
  "card",
  "apple_pay",
  "google_pay",
  "pix",
  "satispay",
];

export const customerCardWallets = {
  applePay: "auto",
  googlePay: "auto",
  link: "never",
} as const;

export const manualCardWallets = {
  applePay: "never",
  googlePay: "never",
  link: "never",
} as const;
