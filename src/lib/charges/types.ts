import type { AdminAppointmentRecord } from "@/lib/appointments/types";
import type { VisitBillSnapshot, VisitPaymentStatus } from "@/lib/charges/visit-bill";
import type { PaymentMethodRecord } from "@/lib/payments/types";

export type ChargeKind = "service" | "no_show" | "cancellation";
export type ChargeStatus = "pending" | "paid" | "failed";
export type ChargeTender = "card" | "cash" | "zelle";
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
  /** Catalog / starting price. Kept when staff changes `amount` at checkout. */
  listAmount?: number;
  catalogId?: string;
  referralCategory?: ReferralChargeCategory;
  /** Dog this service line belongs to. Absent on visit-level lines such as travel. */
  appointmentId?: string;
  petName?: string;
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
  visitId?: string | null;
  kind: ChargeKind;
  status: ChargeStatus;
  lineItems: ChargeLineItem[];
  subtotal: number;
  tipAmount: number;
  total: number;
  receiptChannel: ReceiptChannel | null;
  paidAt: string | null;
  refundedAmount: number;
  paymentMethodId?: string | null;
  tender?: ChargeTender;
  billSnapshot?: VisitBillSnapshot | null;
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
  visit?: {
    id: string;
    customerName: string;
    serviceDate: string;
    arrivalLabel: string;
    servicedDogCount: number;
    blockedMessage: string | null;
    paymentStatus: VisitPaymentStatus;
  };
  referral?: {
    availableCreditCents: number;
    applyNewClientDiscount: boolean;
    canUseCredit: boolean;
    referralCode?: string | null;
    canEnterReferralCode?: boolean;
  };
};

export type CreateChargeInput = {
  appointmentId: string;
  kind: ChargeKind;
  lineItems: ChargeLineItem[];
  tipAmount: number;
  paymentMethodId?: string;
  useNewCard?: boolean;
  tender?: ChargeTender;
  referralMode?: "full" | "custom" | "none";
  referralCustomDollars?: number;
  referralCode?: string;
};
