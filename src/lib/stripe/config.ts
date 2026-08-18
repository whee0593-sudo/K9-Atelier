export function getStripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() || "";
}

export function getStripePublishableKey() {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || "";
}

export function isStripeConfigured() {
  return Boolean(getStripeSecretKey() && getStripePublishableKey());
}
