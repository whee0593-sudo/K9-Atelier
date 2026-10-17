import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const ORDER = [
  "supabase/migrations/20261009120000_visit_notifications.sql",
  "supabase/migrations/20261009130000_communication_logs.sql",
  "supabase/migrations/20261009140000_visit_notification_attempts.sql",
  "supabase/migrations/20261016020000_merchant_communication_compatibility.sql",
];

function sql(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

async function applyAll(db: PGlite) {
  for (const file of ORDER) {
    await db.exec(sql(file));
  }
}

describe("notification migrations", () => {
  it("documents order, stays additive, and can run twice on an existing schema", async () => {
    assert.match(sql(ORDER[0]!), /CREATE TABLE IF NOT EXISTS public\.visit_notifications/);
    assert.match(sql(ORDER[1]!), /CREATE SCHEMA IF NOT EXISTS private/);
    assert.match(sql(ORDER[1]!), /CREATE TABLE IF NOT EXISTS public\.communication_logs/);
    assert.equal(/^\s*CREATE TABLE/m.test(sql(ORDER[3]!)), false);
    assert.match(sql(ORDER[3]!), /ADD COLUMN IF NOT EXISTS provider_called_at/);

    const db = new PGlite();
    await db.exec(`
      CREATE SCHEMA IF NOT EXISTS private;
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOINHERIT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated NOINHERIT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role NOINHERIT BYPASSRLS;
        END IF;
      END $$;
      ALTER ROLE service_role BYPASSRLS;
      CREATE TABLE public.profiles (id uuid PRIMARY KEY);
      CREATE TABLE public.visits (id uuid PRIMARY KEY);
      CREATE TABLE private.staff_probe (enabled boolean NOT NULL);
      INSERT INTO private.staff_probe (enabled) VALUES (false);
      CREATE OR REPLACE FUNCTION private.is_staff()
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = ''
      AS $$
        SELECT enabled FROM private.staff_probe LIMIT 1;
      $$;
      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    `);

    await applyAll(db);
    await applyAll(db);

    const visit = "11111111-1111-4111-8111-111111111111";
    const customer = "22222222-2222-4222-8222-222222222222";
    await db.query(`INSERT INTO public.visits (id) VALUES ($1)`, [visit]);
    await db.query(`INSERT INTO public.profiles (id) VALUES ($1)`, [customer]);
    await db.query(
      `
        INSERT INTO public.visit_notifications (visit_id, event, status)
        VALUES ($1, 'booking_confirmation', 'sending')
      `,
      [visit],
    );
    await db.query(
      `
        INSERT INTO public.communication_logs (
          channel, notification_type, recipient, body_text, status, idempotency_key
        ) VALUES ('email', 'booking_confirmation', 'sarah@example.com', 'Hello', 'pending', 'once')
      `,
    );
    const column = await db.query<{ column_name: string }>(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'communication_logs'
          AND column_name = 'provider_called_at'
      `,
    );
    assert.equal(column.rows[0]?.column_name, "provider_called_at");
    await db.close();
  });
});