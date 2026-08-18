# Payment Method Policy & Validation

> Customer-facing copy is English. This doc explains the approach for Penny (中文).

## Policy (updated)

- **Pet profile:** A **valid payment method** must be on file before a pet profile can be saved.
- **At booking:** After date and time are chosen, the customer selects which saved card to use for that appointment.
- **At booking:** **No charge** — card is on file only.
- **After service:** Charge the selected card for the appointment total.
- **Later charges:** cancellation / no-show fees per the published policy.

---

## How do we test if a payment method is valid?

**Recommended: Stripe Setup Intents** (行业里最常用的「只存卡、不扣款」方式)

### Plain language

When the customer enters card details, Stripe talks to the **card network / bank** in real time to check:

- Card number format is correct  
- Card is not expired  
- Bank does not immediately decline the card  
- Sometimes **3D Secure** (bank text/app verification) is required  

If all pass, Stripe saves the card as a **Payment Method** attached to the customer. **No charge** appears on their statement at booking time (Stripe may use a temporary $0 authorization that disappears — normal and invisible to most customers).

This is **much better** than only checking "16 digits look right" on your own — only Stripe/bank can say if the card actually works.

---

## Implementation

See `content/STRIPE.md` for Stripe keys and the SQL to run. The site uses **Setup Intents** so cards are validated and stored without charging at booking.

Charging after the appointment (and for cancellation / no-show) is a later Stripe PaymentIntent step.

### Test mode (before going live)

Stripe provides **test card numbers** — no real money:

| Card number | Result |
|-------------|--------|
| `4242 4242 4242 4242` | Success — valid card |
| `4000 0000 0000 0002` | Declined — simulates invalid/declined |
| `4000 0025 0000 3155` | Requires 3D Secure authentication |

Use any future expiry, any 3-digit CVC, any ZIP in test mode.

Toggle: Stripe Dashboard → **Test mode** ON while developing.

---

## Alternatives (not recommended as primary)

| Method | Problem |
|--------|---------|
| Only check card format yourself | Does not prove card works or has funds |
| Charge $1 then refund | Extra fees, customer confusion |
| Manual "send card photo" | Not secure, not PCI compliant |

---

## Legal / policy pages (later)

When live, add to FAQ / Terms:

- Card saved at booking; not charged until [service / cancellation policy]  
- How to update or remove card  
- Cancellation/no-show may trigger charge to saved method  

---

## Config source

`content/business.json` → `booking.requiresPaymentMethod`, `booking.chargeAtBooking`, `booking.paymentMethodNote`

*Updated: 2026-07-29*
