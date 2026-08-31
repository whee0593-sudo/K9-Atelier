export type ClientRole = "anon" | "authenticated_customer" | "authenticated_staff";

export type RpcSecuritySpec = {
  name: string;
  schema: "public";
  searchablePathFixed: boolean;
  schemaQualified: boolean;
  clientExecute: {
    anon: boolean;
    authenticated: boolean;
  };
  usedByWebsiteClient: boolean;
};

export const RPC_SECURITY_SPECS: RpcSecuritySpec[] = [
  {
    name: "referral_available_cents",
    schema: "public",
    searchablePathFixed: true,
    schemaQualified: true,
    clientExecute: { anon: false, authenticated: false },
    usedByWebsiteClient: false,
  },
  {
    name: "rls_auto_enable",
    schema: "public",
    searchablePathFixed: true,
    schemaQualified: true,
    clientExecute: { anon: false, authenticated: false },
    usedByWebsiteClient: false,
  },
  {
    name: "archive_own_pet",
    schema: "public",
    searchablePathFixed: true,
    schemaQualified: true,
    clientExecute: { anon: false, authenticated: true },
    usedByWebsiteClient: true,
  },
  {
    name: "is_staff_user",
    schema: "public",
    searchablePathFixed: true,
    schemaQualified: true,
    clientExecute: { anon: false, authenticated: true },
    usedByWebsiteClient: true,
  },
  {
    name: "is_owner_user",
    schema: "public",
    searchablePathFixed: true,
    schemaQualified: true,
    clientExecute: { anon: false, authenticated: true },
    usedByWebsiteClient: true,
  },
  {
    name: "staff_set_appointment_status",
    schema: "public",
    searchablePathFixed: true,
    schemaQualified: true,
    clientExecute: { anon: false, authenticated: true },
    usedByWebsiteClient: true,
  },
  {
    name: "staff_set_vaccination_verification",
    schema: "public",
    searchablePathFixed: true,
    schemaQualified: true,
    clientExecute: { anon: false, authenticated: true },
    usedByWebsiteClient: true,
  },
  {
    name: "staff_upsert_pet_admin_notes",
    schema: "public",
    searchablePathFixed: true,
    schemaQualified: true,
    clientExecute: { anon: false, authenticated: true },
    usedByWebsiteClient: true,
  },
];

export const INTERNAL_DEFINER_FUNCTIONS = [
  "rls_auto_enable",
  "referral_available_cents",
] as const;

export const STAFF_WRITE_FUNCTIONS = [
  "staff_set_appointment_status",
  "staff_set_vaccination_verification",
  "staff_upsert_pet_admin_notes",
] as const;

export function clientMayExecute(name: string, role: ClientRole) {
  const spec = RPC_SECURITY_SPECS.find((row) => row.name === name);
  if (!spec) return false;
  if (role === "anon") return spec.clientExecute.anon;
  return spec.clientExecute.authenticated;
}

export function canArchivePet(input: {
  actorCustomerId: string | null;
  petCustomerId: string;
  archivedAt?: string | null;
}) {
  if (!input.actorCustomerId) return false;
  if (input.archivedAt) return false;
  return input.actorCustomerId === input.petCustomerId;
}

export function canRunStaffWrite(input: { isStaff: boolean }) {
  return input.isStaff === true;
}

export function staffStatusRpcSignature() {
  return {
    isStaffUserArgs: [] as const,
    isOwnerUserArgs: [] as const,
    acceptsTargetUserId: false,
  };
}

export function evaluateStaffStatusRpc(input: {
  currentUserIsStaff: boolean;
  requestedUserId?: string;
}) {
  if (input.requestedUserId) {
    return { ok: false as const, reason: "no_target_user_id" };
  }
  return { ok: true as const, isStaff: input.currentUserIsStaff };
}

export function clientCanReadOtherCustomerReferralBalance() {
  return false;
}
