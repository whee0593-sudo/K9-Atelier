import fs from "node:fs";
import path from "node:path";
import pg from "pg";

function loadEnvLocal(): Record<string, string> {
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

function getDatabaseUrl(env: Record<string, string>) {
  return (
    env.DATABASE_URL ||
    env.SUPABASE_DB_URL ||
    env.POSTGRES_URL ||
    env.DIRECT_URL ||
    ""
  );
}

async function runMigration() {
  const env = { ...process.env, ...loadEnvLocal() };
  const databaseUrl = getDatabaseUrl(env);
  const projectRef = env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]
    : "unknown";

  console.log("PROJECT_REF:", projectRef);

  if (!databaseUrl) {
    console.log("MIGRATION: failed");
    console.log(
      "REASON: missing DATABASE_URL (add to .env.local from Supabase Dashboard → Database → Connection string)",
    );
    process.exit(1);
  }

  const migrationPath = path.join(
    "supabase",
    "migrations",
    "20260808010900_account_pets_foundation.sql",
  );
  const sql = fs.readFileSync(migrationPath, "utf8");

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query(sql);
    console.log("MIGRATION: successful");
  } catch (error) {
    console.log("MIGRATION: failed");
    console.log(
      "ERROR:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration().catch((error) => {
  console.log("MIGRATION: failed");
  console.log("ERROR:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
