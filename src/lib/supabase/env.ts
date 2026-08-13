function normalizeEnvValue(value: string | undefined) {
  if (!value) return "";
  let normalized = value.trim();
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }
  return normalized;
}

export function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && getSupabasePublicKey(),
  );
}

export function getSupabaseUrl() {
  const url = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return url;
}

export function getSupabasePublicKey() {
  return (
    normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
    normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    ""
  );
}

export function getSupabasePublicKeySource():
  | "publishable"
  | "anon"
  | "missing" {
  if (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return "publishable";
  }
  if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return "anon";
  }
  return "missing";
}

export function getSupabaseAnonKey() {
  const key = getSupabasePublicKey();
  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  return key;
}

export function getSupabaseSecretKey() {
  const key =
    normalizeEnvValue(process.env.SUPABASE_SECRET_KEY) ||
    normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return key;
}

export function getSupabaseSecretKeySource(): "secret" | "service_role" | "missing" {
  if (normalizeEnvValue(process.env.SUPABASE_SECRET_KEY)) return "secret";
  if (normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    return "service_role";
  }
  return "missing";
}

export function hasSupabaseAdminConfig() {
  return getSupabaseSecretKeySource() !== "missing";
}
