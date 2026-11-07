import type { ServiceAddress } from "@/lib/travel";

export function hasServiceAddress(address: ServiceAddress | null | undefined): address is ServiceAddress {
  return Boolean(address && [address.street, address.city, address.state, address.zip].every(value => value?.trim()));
}

export function appointmentNeedsAddress(appointment: {
  addressStreet: string; addressCity: string; addressState: string; addressZip: string;
}) {
  return !hasServiceAddress({ street: appointment.addressStreet, city: appointment.addressCity,
    state: appointment.addressState, zip: appointment.addressZip });
}

export const MISSING_BOOKING_ADDRESS_MESSAGE = "Add your service address to complete this appointment. Your travel fee will be calculated after you save it.";
