export type AdminReferralCodeRow = {
  id: string;
  customerId: string;
  customerName: string;
  petName: string;
  code: string;
  active: boolean;
};

export type AdminReferralRelationshipRow = {
  id: string;
  referrerName: string;
  referredName: string;
  petName: string;
  code: string;
  status: string;
  reviewRequired: boolean;
  createdAt: string;
};

export type AdminReferralSourceRow = {
  id: string;
  referrerName: string;
  referredName: string;
  code: string;
  status: string;
  rewardCents: number;
  remainingCents: number;
  visitKey: string | null;
  issuedAt: string | null;
  sourceChargeId: string;
};

export type AdminReferralBalanceRow = {
  customerId: string;
  customerName: string;
  pendingCents: number;
  availableCents: number;
  usedCents: number;
};

export type AdminReferralAuditRow = {
  id: string;
  action: string;
  reason: string | null;
  customerName: string;
  createdAt: string;
};

export type AdminReferralReservationRow = {
  id: string;
  customerId: string;
  customerName: string;
  appointmentId: string | null;
  chargeId: string | null;
  amountCents: number;
  reservedAt: string;
  expiresAt: string | null;
  hasPaymentIntent: boolean;
  stripePaymentIntentId: string | null;
  stripeStatus: string | null;
  status: string;
};

export type AdminReferralDashboard = {
  balances: AdminReferralBalanceRow[];
  codes: AdminReferralCodeRow[];
  relationships: AdminReferralRelationshipRow[];
  sources: AdminReferralSourceRow[];
  review: AdminReferralSourceRow[];
  reservations: AdminReferralReservationRow[];
  audit: AdminReferralAuditRow[];
};
