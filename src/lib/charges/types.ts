import type { AdminAppointmentRecord } from "@/lib/appointments/types";
import type { PaymentMethodRecord } from "@/lib/payments/types";

export type ChargeKind = "service" | "no_show" | "cancellation";
export type ChargeStatus = "pending" | "paid" | "failed";
export type ReceiptChannel = "sms" | "email";

export type ReferralChargeCategory =
  | "eligible_service"
  | "travel_fee"
  | "special_handling"
  | "gratuity"
  | "other_ineligible";

export type ChargeLineItem = {
  id: string;
  label: string;
  amount: number;
  catalogId?: string;
  referralCategory?: ReferralChargeCategory;
};

export type CatalogChargeItem = {
  id: string;
  name: string;
  suggestedAmount: number | null;
};

export type CatalogChargeGroup = {
  id: string;
  name: string;
  items: CatalogChargeItem[];
};

export type AppointmentChargeRecord = {
  id: string;
  appointmentId: string;
  kind: ChargeKind;
  status: ChargeStatus;
  lineItems: ChargeLineItem[];
  subtotal: number;
  tipAmount: number;
  total: number;
  receiptChannel: ReceiptChannel | null;
  paidAt: string | null;
  refundedAmount: number;
};

export type CollectContext = {
  appointment: AdminAppointmentRecord;
  petWeightLbs: number;
  lineItems: ChargeLineItem[];
  catalog: CatalogChargeItem[];
  catalogGroups: CatalogChargeGroup[];
  methods: PaymentMethodRecord[];
  selectedPaymentMethodId: string | null;
  paidKinds: ChargeKind[];
  paidCharges: AppointmentChargeRecord[];
  stripeConfigured: boolean;
  stripePublishableKey: string;
  referral?: {
    availableCreditCents: number;
    applyNewClientDiscount: boolean;
    canUseCredit: boolean;
    referralCode?: string | null;
  };
};

export type CreateChargeInput = {
  appointmentId: string;
  kind: ChargeKind;
  lineItems: ChargeLineItem[];
  tipAmount: number;
  paymentMethodId?: string;
  useNewCard?: boolean;
  referralMode?: "full" | "custom" | "none";
  referralCustomDollars?: number;
  referralCode?: string;
};
