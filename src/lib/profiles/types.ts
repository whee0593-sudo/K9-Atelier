import { readAllergyStatus, type AllergyStatus } from "@/lib/allergies";

export type CustomerProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  birthday?: string | null;
  preferredContact: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  householdAllergyStatus?: AllergyStatus | null;
  householdAllergyDetails?: string | null;
};

export type CustomerProfileWriteInput = {
  firstName: string;
  lastName: string;
  phone: string;
  birthday?: string | null;
  preferredContact: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
  householdAllergyStatus?: AllergyStatus | null;
  householdAllergyDetails?: string | null;
  /** Staff-only: login email. Customers cannot change email from My Account. */
  email?: string;
};

export type CustomerProfileRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  birthday?: string | null;
  preferred_contact: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  household_allergy_status?: AllergyStatus | null;
  household_allergy_details?: string | null;
};

export const PREFERRED_CONTACT_OPTIONS = ["Email", "Text Message"] as const;

export const EMERGENCY_RELATIONSHIP_OPTIONS = [
  "Spouse",
  "Partner",
  "Family",
  "Friend",
  "Neighbor",
  "Other",
] as const;

export function mapProfileRow(row: CustomerProfileRow): CustomerProfile {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    phone: row.phone ?? "",
    birthday: row.birthday ?? null,
    preferredContact: row.preferred_contact ?? "",
    emergencyContactName: row.emergency_contact_name ?? "",
    emergencyContactPhone: row.emergency_contact_phone ?? "",
    emergencyContactRelationship: row.emergency_contact_relationship ?? "",
    householdAllergyStatus:
      readAllergyStatus(row.household_allergy_status ?? null) ?? null,
    householdAllergyDetails: row.household_allergy_details ?? null,
  };
}
