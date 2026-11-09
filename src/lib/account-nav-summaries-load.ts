import { listCustomerAppointments } from "@/lib/appointments/service";
import {
  buildAccountNavSummaries,
  emptyAccountNavSummaries,
  type AccountNavSummaries,
} from "@/lib/account-nav-summaries";
import { listCustomerPaymentMethods } from "@/lib/payments/service";
import { listPets } from "@/lib/pets/service";
import { getOwnProfile } from "@/lib/profiles/service";
import { listOwnServiceAddresses } from "@/lib/profiles/customer-addresses";

export async function getAccountNavSummaries(): Promise<AccountNavSummaries> {
  try {
    const [
      profileResult,
      petsResult,
      paymentResult,
      appointmentsResult,
      addressesResult,
    ] = await Promise.all([
      getOwnProfile(),
      listPets(),
      listCustomerPaymentMethods(),
      listCustomerAppointments(),
      listOwnServiceAddresses(),
    ]);

    return buildAccountNavSummaries({
      savedAddressCount: "addresses" in addressesResult ? addressesResult.addresses.length : null,
      profile: "profile" in profileResult ? profileResult.profile : null,
      pets: "pets" in petsResult ? petsResult.pets : null,
      paymentMethodCount:
        "methods" in paymentResult ? paymentResult.methods.length : null,
      appointments:
        "appointments" in appointmentsResult
          ? appointmentsResult.appointments
          : null,
    });
  } catch (error) {
    console.error("getAccountNavSummaries failed:", error);
    return emptyAccountNavSummaries();
  }
}
