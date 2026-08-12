export function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && getSupabasePublicKey(),
  );
}

export function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return url;
}

export function getSupabasePublicKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
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
