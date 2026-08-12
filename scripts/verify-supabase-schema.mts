import fs from "node:fs";
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

const EXPECTED_TABLES = [
  "profiles",
  "pets",
  "pet_admin_notes",
  "pet_vaccination_records",
] as const;

const EXPECTED_POLICIES = [
  "profiles_select_own_or_staff",
  "profiles_update_own",
  "pets_select_own_or_staff",
  "pets_insert_own",
  "pets_update_own",
  "pets_archive_own",
  "pet_admin_notes_staff_all",
  "pet_vaccination_records_select_own_or_staff",
  "vaccinations_select_own_or_staff",
] as const;

const EXPECTED_POLICY_COUNT = EXPECTED_POLICIES.length;

async function verifyMigration() {
  const env = { ...process.env, ...loadEnvLocal() };
  const databaseUrl = getDatabaseUrl(env);
  const projectRef = env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]
    : "unknown";

  console.log("PROJECT_REF:", projectRef);

  if (!databaseUrl) {
    console.log("VERIFY: failed");
    console.log("REASON: missing DATABASE_URL");
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    for (const table of EXPECTED_TABLES) {
      const result = await client.query(
        `SELECT to_regclass($1) AS regclass`,
        [`public.${table}`],
      );
      const exists = result.rows[0]?.regclass !== null;
      console.log(`TABLE_${table.toUpperCase()}:`, exists ? "ok" : "missing");
      if (!exists) process.exitCode = 1;
    }

    const staffTable = await client.query(
      `SELECT to_regclass('private.staff_members') AS regclass`,
    );
    console.log(
      "TABLE_PRIVATE_STAFF_MEMBERS:",
      staffTable.rows[0]?.regclass ? "ok" : "missing",
    );
    if (!staffTable.rows[0]?.regclass) process.exitCode = 1;

    const archiveRpc = await client.query(
      `SELECT to_regprocedure('public.archive_own_pet(uuid)') AS regproc`,
    );
    console.log(
      "FUNCTION_ARCHIVE_OWN_PET:",
      archiveRpc.rows[0]?.regproc ? "ok" : "missing",
    );
    if (!archiveRpc.rows[0]?.regproc) process.exitCode = 1;

    const bucket = await client.query(
      `SELECT id FROM storage.buckets WHERE id = 'pet-vaccinations'`,
    );
    console.log(
      "BUCKET_PET_VACCINATIONS:",
      bucket.rowCount === 1 ? "ok" : "missing",
    );
    if (bucket.rowCount !== 1) process.exitCode = 1;

    const view = await client.query(
      `SELECT relname FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = 'pet_vaccination_effective_status'
         AND c.relkind = 'v'`,
    );
    console.log(
      "VIEW_PET_VACCINATION_EFFECTIVE_STATUS:",
      view.rowCount === 1 ? "ok" : "missing",
    );
    if (view.rowCount !== 1) process.exitCode = 1;

    const viewOptions = await client.query(
      `SELECT c.reloptions
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = 'pet_vaccination_effective_status'`,
    );
    const reloptions = (viewOptions.rows[0]?.reloptions ?? []) as string[];
    console.log(
      "VIEW_SECURITY_INVOKER:",
      reloptions.includes("security_invoker=true") ? "ok" : "missing",
    );
    if (!reloptions.includes("security_invoker=true")) process.exitCode = 1;

    const policyCount = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM pg_policies
       WHERE schemaname IN ('public', 'storage')
         AND policyname = ANY($1::text[])`,
      [EXPECTED_POLICIES as unknown as string[]],
    );
    const count = policyCount.rows[0]?.count ?? 0;
    console.log("POLICY_COUNT:", count);
    console.log(
      "POLICY_COUNT_OK:",
      count === EXPECTED_POLICY_COUNT ? "yes" : "no",
    );
    if (count !== EXPECTED_POLICY_COUNT) process.exitCode = 1;

    const rls = await client.query(
      `SELECT c.relname, c.relrowsecurity
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = ANY($1::text[])`,
      [EXPECTED_TABLES as unknown as string[]],
    );
    for (const row of rls.rows) {
      console.log(
        `RLS_${String(row.relname).toUpperCase()}:`,
        row.relrowsecurity ? "enabled" : "disabled",
      );
      if (!row.relrowsecurity) process.exitCode = 1;
    }

    console.log("VERIFY:", process.exitCode === 1 ? "failed" : "successful");
  } finally {
    await client.end();
  }
}

verifyMigration().catch((error) => {
  console.log("VERIFY: failed");
  console.log("ERROR:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
