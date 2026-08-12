import fs from "node:fs";

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

async function main() {
  const env = { ...process.env, ...loadEnvLocal() };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.log("CONNECTION: failed");
    console.log("REASON: missing env");
    process.exit(1);
  }

  const ref = new URL(url).hostname.split(".")[0];
  console.log("PROJECT_REF:", ref);

  const response = await fetch(`${url}/auth/v1/health`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });

  console.log("CONNECTION:", response.ok ? "successful" : "failed");
  if (!response.ok) {
    console.log("REASON: http_" + response.status);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.log("CONNECTION: failed");
  console.log(
    "REASON:",
    error instanceof Error ? error.message : "unknown error",
  );
  process.exit(1);
});
