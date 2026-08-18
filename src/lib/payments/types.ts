export type PaymentMethodRecord = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
};

export type PaymentMethodRow = {
  id: string;
  customer_id: string;
  stripe_payment_method_id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
};

export function formatPaymentMethodLabel(method: PaymentMethodRecord) {
  const brand = method.brand ? capitalizeBrand(method.brand) : "Card";
  const exp = `${String(method.expMonth).padStart(2, "0")}/${String(method.expYear).slice(-2)}`;
  return `${brand} •••• ${method.last4}  Exp ${exp}`;
}

function capitalizeBrand(brand: string) {
  if (!brand) return "Card";
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

export function mapPaymentMethodRow(row: PaymentMethodRow): PaymentMethodRecord {
  return {
    id: row.id,
    brand: row.brand,
    last4: row.last4,
    expMonth: row.exp_month,
    expYear: row.exp_year,
    isDefault: row.is_default,
  };
}
