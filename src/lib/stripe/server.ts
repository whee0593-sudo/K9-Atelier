import Stripe from "stripe";
import { getStripeSecretKey } from "@/lib/stripe/config";

let stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = getStripeSecretKey();
  if (!key) return null;
  if (!stripe) {
    stripe = new Stripe(key);
  }
  return stripe;
}
