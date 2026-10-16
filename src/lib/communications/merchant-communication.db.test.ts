import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const CUSTOMER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VISIT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LOG = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const KEY = "email|merchant_visit_confirmed|staff|visit:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb|-";

let db: PGlite;

function migrationSql() {
  return readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20261016020000_merchant_communication_compatibility.sql",
    ),
    "utf8",
  );
}

async function rejectSql(sql: string) {
  try {
    await db.exec(sql);
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

before(async () => {
  db = new PGlite();
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
        CREATE ROLE service_role NOINHERIT;
      END IF;
    END $$;

    CREATE TABLE private.staff_flag (is_staff boolean NOT NULL DEFAULT false);
    INSERT INTO private.staff_flag (is_staff) VALUES (false);
    CREATE FUNCTION private.is_staff()
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = ''
    AS $$ SELECT is_staff FROM private.staff_flag LIMIT 1 $$;

    CREATE TABLE public.profiles (
      id uuid PRIMARY KEY
    );
    CREATE TABLE public.visits (
      id uuid PRIMARY KEY
    );
    INSERT INTO public.profiles (id) VALUES ('${CUSTOMER}');
    INSERT INTO public.visits (id) VALUES ('${VISIT}');
    GRANT USAGE ON SCHEMA public TO authenticated, service_role;
    GRANT USAGE ON SCHEMA private TO authenticated;
    GRANT EXECUTE ON FUNCTION private.is_staff() TO authenticated;
  `);
  await db.exec(migrationSql());
});

describe("communication log protection in postgres", () => {
  it("creates the ledger once and does not install a second claim function", async () => {
    await db.exec(migrationSql());
    const claim = await db.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM pg_proc
       WHERE proname = 'communication_logs_claim'`,
    );
    assert.equal(claim.rows[0]?.count, "0");
    const triggers = await db.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM pg_trigger
       WHERE tgname = 'communication_logs_protect_snapshot'
         AND NOT tgisinternal`,
    );
    assert.equal(triggers.rows[0]?.count, "1");
  });

  it("freezes the snapshot and still allows status and provider_called_at", async () => {
    await db.query(
      `INSERT INTO public.communication_logs (
         id, channel, notification_type, audience, customer_id, visit_id,
         recipient, body_text, status, idempotency_key
       ) VALUES (
         $1, 'email', 'merchant_visit_confirmed', 'staff', $2, $3,
         'penny@k9atelier.com', 'New visit confirmed', 'pending', $4
       )`,
      [LOG, CUSTOMER, VISIT, KEY],
    );

    const blocked = await rejectSql(
      `UPDATE public.communication_logs SET body_text = 'changed' WHERE id = '${LOG}'`,
    );
    assert.match(blocked, /communication log snapshot is immutable/);

    const called = await db.query<{ id: string }>(
      `UPDATE public.communication_logs
       SET provider_called_at = now()
       WHERE id = $1 AND provider_called_at IS NULL
       RETURNING id::text AS id`,
      [LOG],
    );
    assert.equal(called.rows.length, 1);

    const raced = await db.query<{ id: string }>(
      `UPDATE public.communication_logs
       SET provider_called_at = now()
       WHERE id = $1 AND provider_called_at IS NULL
       RETURNING id::text AS id`,
      [LOG],
    );
    assert.equal(raced.rows.length, 0);

    await db.query(
      `UPDATE public.communication_logs
       SET status = 'accepted', accepted_at = now(), provider_message_id = 'email-1'
       WHERE id = $1`,
      [LOG],
    );
    const saved = await db.query<{ status: string; delivered_at: string | null }>(
      `SELECT status, delivered_at FROM public.communication_logs WHERE id = $1`,
      [LOG],
    );
    assert.equal(saved.rows[0]?.status, "accepted");
    assert.equal(saved.rows[0]?.delivered_at, null);

    const duplicate = await rejectSql(
      `INSERT INTO public.communication_logs (
         channel, notification_type, audience, recipient, body_text, status, idempotency_key
       ) VALUES (
         'email', 'merchant_visit_confirmed', 'staff', 'penny@k9atelier.com',
         'New visit confirmed', 'pending', '${KEY}'
       )`,
    );
    assert.match(duplicate, /duplicate key|idempotency_key/i);
  });

  it("promotes a skipped row once and refuses failed or uncertain rows", async () => {
    const skippedKey = `${KEY}|skipped`;
    const failedKey = `${KEY}|failed`;
    const uncertainKey = `${KEY}|uncertain`;
    await db.exec(`
      INSERT INTO public.communication_logs (
        channel, notification_type, audience, recipient, body_text, status,
        skip_reason, idempotency_key
      ) VALUES (
        'sms', 'merchant_visit_confirmed', 'staff', 'missing', 'Visit text',
        'skipped', 'missing_config', '${skippedKey}'
      );
      INSERT INTO public.communication_logs (
        channel, notification_type, audience, recipient, body_text, status,
        provider_called_at, idempotency_key
      ) VALUES
      (
        'email', 'merchant_visit_cancelled', 'staff', 'penny@k9atelier.com',
        'Visit cancelled', 'failed', now(), '${failedKey}'
      ),
      (
        'email', 'merchant_reschedule_completed', 'staff', 'penny@k9atelier.com',
        'Visit rescheduled', 'uncertain', now(), '${uncertainKey}'
      );
    `);

    const promoted = await db.query<{ id: string }>(
      `UPDATE public.communication_logs
       SET status = 'pending', provider_called_at = now(), skip_reason = NULL
       WHERE idempotency_key = $1 AND status = 'skipped' AND provider_called_at IS NULL
       RETURNING id::text AS id`,
      [skippedKey],
    );
    assert.equal(promoted.rows.length, 1);
    const promotedAgain = await db.query<{ id: string }>(
      `UPDATE public.communication_logs
       SET provider_called_at = now()
       WHERE idempotency_key = $1 AND provider_called_at IS NULL
       RETURNING id::text AS id`,
      [skippedKey],
    );
    assert.equal(promotedAgain.rows.length, 0);

    for (const key of [failedKey, uncertainKey]) {
      const resent = await db.query<{ id: string }>(
        `UPDATE public.communication_logs
         SET provider_called_at = now()
         WHERE idempotency_key = $1 AND provider_called_at IS NULL
         RETURNING id::text AS id`,
        [key],
      );
      assert.equal(resent.rows.length, 0);
    }
  });

  it("lets staff read logs and blocks other authenticated writes", async () => {
    await db.exec(`UPDATE private.staff_flag SET is_staff = false`);
    await db.exec(`SET ROLE authenticated`);
    const hidden = await db.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM public.communication_logs`,
    );
    assert.equal(hidden.rows[0]?.count, "0");
    const denied = await rejectSql(
      `INSERT INTO public.communication_logs (
         channel, notification_type, audience, recipient, body_text, status, idempotency_key
       ) VALUES (
         'email', 'merchant_visit_confirmed', 'staff', 'penny@k9atelier.com',
         'nope', 'pending', 'email|merchant_visit_confirmed|staff|visit:other|-'
       )`,
    );
    assert.match(denied, /permission denied|row-level security/i);
    await db.exec(`RESET ROLE`);

    await db.exec(`UPDATE private.staff_flag SET is_staff = true`);
    await db.exec(`SET ROLE authenticated`);
    const visible = await db.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM public.communication_logs`,
    );
    assert.ok(Number(visible.rows[0]?.count) >= 1);
    await db.exec(`RESET ROLE`);
  });

  it("leaves an existing trigger function and policy in place on a second run", async () => {
    await db.exec(`RESET ROLE`);
    await db.exec(`
      CREATE OR REPLACE FUNCTION private.communication_logs_protect_snapshot()
      RETURNS trigger
      LANGUAGE plpgsql
      SET search_path = ''
      AS $body$
      BEGIN
        IF NEW.body_text IS DISTINCT FROM OLD.body_text THEN
          RAISE EXCEPTION 'sentinel-protect' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
      $body$;

      DROP POLICY communication_logs_select_staff ON public.communication_logs;
      CREATE POLICY communication_logs_select_staff
        ON public.communication_logs
        FOR SELECT
        TO authenticated
        USING (false);
    `);
    await db.exec(migrationSql());

    const sentinel = await rejectSql(
      `UPDATE public.communication_logs SET body_text = 'replaced' WHERE id = '${LOG}'`,
    );
    assert.match(sentinel, /sentinel-protect/);
    assert.doesNotMatch(sentinel, /communication log snapshot is immutable/);

    await db.exec(`UPDATE private.staff_flag SET is_staff = true`);
    await db.exec(`SET ROLE authenticated`);
    const stillHidden = await db.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM public.communication_logs`,
    );
    assert.equal(stillHidden.rows[0]?.count, "0");
    await db.exec(`RESET ROLE`);
  });
});
