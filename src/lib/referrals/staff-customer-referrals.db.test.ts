import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { it } from "node:test";
import { PGlite } from "@electric-sql/pglite";

it("edits referral details privately and shares the adjusted balance with checkout", async () => {
  const db = new PGlite();
  const customer = "11111111-1111-4111-8111-111111111111";
  const admin = "22222222-2222-4222-8222-222222222222";
  const update = "SELECT public.staff_update_customer_referrals($1, $2, $3, $4, $5, $6) AS balance";
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
      $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE SCHEMA storage;
      CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text,name text);
      CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$SELECT string_to_array($1,'/')$$;
    `);
    const directory = path.join(process.cwd(), "supabase/migrations");
    for (const file of readdirSync(directory).filter((name) => name.endsWith(".sql")).sort()) {
      await db.exec(readFileSync(path.join(directory, file), "utf8"));
    }
    await db.query("INSERT INTO auth.users(id,email) VALUES($1,'customer@example.com'),($2,'staff@example.com')", [customer, admin]);

    await db.exec("SET ROLE service_role");
    const saved = await db.query<{ balance: number }>(update, [customer, admin, "referral", "Alex", 0, 2500]);
    assert.equal(saved.rows[0].balance, 2500);
    await db.query("SELECT public.reserve_referral_credit($1, NULL, NULL, 1000, $2)", [customer, admin]);
    await assert.rejects(db.query(update, [customer, admin, "google", null, 2500, 3000]), /referral_balance_changed/);
    const current = await db.query("SELECT referral_source, referral_name, public.referral_available_cents(id) AS balance FROM public.profiles WHERE id = $1", [customer]);
    assert.deepEqual(current.rows, [{ referral_source: "referral", referral_name: "Alex", balance: 1500 }]);
    await db.query(update, [customer, admin, "google", null, 1500, 0]);
    await assert.rejects(db.query("SELECT public.reserve_referral_credit($1, NULL, NULL, 1, $2)", [customer, admin]), /insufficient_credit/);
    const audit = await db.query("SELECT admin_user_id FROM public.referral_audit_log WHERE customer_id = $1 AND action = 'update_customer_referrals'", [customer]);
    assert.deepEqual(audit.rows, [{ admin_user_id: admin }, { admin_user_id: admin }]);

    await db.exec(`RESET ROLE; SET ROLE authenticated; SET request.jwt.claim.sub = '${customer}'`);
    assert.equal((await db.query("SELECT id FROM public.profiles WHERE id = $1", [customer])).rows.length, 1);
    assert.equal((await db.query("SELECT id FROM public.referral_credit_ledger WHERE customer_id = $1", [customer])).rows.length, 0);
    await assert.rejects(db.query("SELECT referral_source FROM public.profiles WHERE id = $1", [customer]), /permission denied/);
    await assert.rejects(db.query(update, [customer, admin, "google", null, 0, 5000]), /permission denied/);
  } finally {
    await db.close();
  }
});
