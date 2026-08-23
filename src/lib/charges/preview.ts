import { catalogChargeGroups, catalogChargeItems } from "@/lib/charges/catalog";
import type { AppointmentChargeRecord, CollectContext } from "@/lib/charges/types";

export function buildPreviewCollectContext(
  options: { paid?: boolean } = {},
): CollectContext {
  const petWeightLbs = 18;
  const lineItems = [
    {
      id: "preview-bath",
      label: "Signature Bath & Care",
      amount: 140,
      catalogId: "signature-bath-care",
    },
  ];
  const tipAmount = 25.2;
  const paidCharge: AppointmentChargeRecord | null = options.paid
    ? {
        id: "preview-charge",
        appointmentId: "preview",
        kind: "service",
        status: "paid",
        lineItems,
        subtotal: 140,
        tipAmount,
        total: 165.2,
        receiptChannel: "email",
        paidAt: "2026-07-08T15:10:00.000Z",
        refundedAmount: 0,
      }
    : null;
  return {
    appointment: {
      id: "preview",
      customerId: "preview-customer",
      petId: "preview-pet",
      petName: options.paid ? "Daisy" : "Maple",
      petBreed: options.paid ? "Goldendoodle" : "Cavapoo",
      serviceId: "signature-bath-care",
      serviceName: "Signature Bath & Care",
      addOnIds: ["mini-trim"],
      addOnOptions: {},
      addressStreet: "1408 14th Lane",
      addressCity: "Palm Beach Gardens",
      addressState: "FL",
      addressZip: "33418",
      travelDistanceMiles: 12,
      travelFee: 13,
      appointmentDate: options.paid ? "2026-07-08" : "2026-09-20",
      appointmentTime: options.paid ? "09:00" : "10:00",
      scheduledStart: null,
      timePreference: "morning",
      timezone: "America/New_York",
      estimatedTotal: 126,
      newClientDeposit: null,
      vaccinationStatusAtBooking: null,
      status: "confirmed",
      confirmedAt: "2026-08-20T14:00:00.000Z",
      createdAt: "2026-08-20T14:00:00.000Z",
      customerEmail: "alex@example.com",
      customerName: options.paid ? "Maya Patel" : "Alex Rivera",
      customerFirstName: options.paid ? "Maya" : "Alex",
      customerPhone: "+15615550123",
      reminderSmsSentAt: null,
      enRouteSmsSentAt: null,
      serviceStartedAt: null,
      serviceEndedAt: null,
    },
    petWeightLbs,
    lineItems,
    catalog: catalogChargeItems(petWeightLbs),
    catalogGroups: catalogChargeGroups(petWeightLbs),
    methods: [
      {
        id: "preview-card",
        brand: "visa",
        last4: "4242",
        expMonth: 12,
        expYear: 2028,
        isDefault: true,
      },
    ],
    selectedPaymentMethodId: "preview-card",
    paidKinds: paidCharge ? ["service"] : [],
    paidCharges: paidCharge ? [paidCharge] : [],
    stripeConfigured: true,
    stripePublishableKey: "",
  };
}
