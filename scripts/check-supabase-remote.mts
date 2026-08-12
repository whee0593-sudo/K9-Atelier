import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const env: Record<string, string> = {};
  if (!fs.existsSync(".env.local")) return env;
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

const env = { ...process.env, ...loadEnvLocal() };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.log("REMOTE_CHECK: missing public supabase env");
  process.exit(1);
}

const ref = new URL(url).hostname.split(".")[0];
console.log("PROJECT_REF:", ref);

const supabase = createClient(url, key);

async function checkMigrationState() {
  const openApiRes = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const openApiText = await openApiRes.text();
  const tables = [
    "profiles",
    "pets",
    "pet_admin_notes",
    "pet_vaccination_records",
  ];
  for (const table of tables) {
    console.log(
      `TABLE_${table.toUpperCase()}:`,
      openApiText.includes(`"/${table}"`) ? "present" : "missing",
    );
  }

  const { error: profilesError } = await supabase
    .from("profiles")
    .select("id", { head: true, count: "exact" });

  console.log(
    "PROFILES_QUERY:",
    profilesError ? `error:${profilesError.code}` : "ok",
  );
}

checkMigrationState().catch((error) => {
  console.log("REMOTE_CHECK_ERROR:", error.message);
  process.exit(1);
});
