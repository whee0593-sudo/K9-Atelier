import { listCustomerAppointments } from "@/lib/appointments/service";
import {
  buildAccountNavSummaries,
  emptyAccountNavSummaries,
  type AccountNavSummaries,
} from "@/lib/account-nav-summaries";
import { listCustomerPaymentMethods } from "@/lib/payments/service";
import { listPets } from "@/lib/pets/service";
import { getOwnProfile } from "@/lib/profiles/service";
import { getAccountReferralView } from "@/lib/referrals/service";

export async function getAccountNavSummaries(
  customerId: string,
): Promise<AccountNavSummaries> {
  try {
    const [
      profileResult,
      petsResult,
      paymentResult,
      appointmentsResult,
      referralResult,
    ] = await Promise.all([
      getOwnProfile(),
      listPets(),
      listCustomerPaymentMethods(),
      listCustomerAppointments(),
      getAccountReferralView(customerId).catch((error: unknown) => {
        console.error("getAccountNavSummaries referrals failed:", error);
        return null;
      }),
    ]);

    return buildAccountNavSummaries({
      profile: "profile" in profileResult ? profileResult.profile : null,
      pets: "pets" in petsResult ? petsResult.pets : null,
      paymentMethodCount:
        "methods" in paymentResult ? paymentResult.methods.length : null,
      appointments:
        "appointments" in appointmentsResult
          ? appointmentsResult.appointments
          : null,
      referralCodes: referralResult
        ? referralResult.codes.map((row) => row.code)
        : null,
      availableCreditCents: referralResult
        ? referralResult.availableCreditCents
        : null,
    });
  } catch (error) {
    console.error("getAccountNavSummaries failed:", error);
    return emptyAccountNavSummaries();
  }
}
