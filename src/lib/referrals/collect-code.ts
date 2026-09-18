export function shouldShowCollectReferralCode(referral?: {
  canEnterReferralCode?: boolean | null;
} | null) {
  return Boolean(referral?.canEnterReferralCode);
}
