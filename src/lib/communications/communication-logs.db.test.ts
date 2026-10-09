import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const CUSTOMER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CUSTOMER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const VISIT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const APPOINTMENT = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PET = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

let db: PGlite;

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
        CREATE ROLE service_role NOINHERIT BYPASSRLS;
      END IF;
    END $$;
    ALTER ROLE service_role BYPASSRLS;

    CREATE TABLE public.profiles (
      id uuid PRIMARY KEY
    );
    CREATE TABLE public.visits (
      id uuid PRIMARY KEY
    );
    CREATE TABLE private.staff_probe (
      enabled boolean NOT NULL
    );
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

  const migration = readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20261009130000_communication_logs.sql",
    ),
    "utf8",
  );
  await db.exec(migration);
  await db.exec(`
    INSERT INTO public.profiles (id) VALUES ('${CUSTOMER_A}'), ('${CUSTOMER_B}');
    INSERT INTO public.visits (id) VALUES ('${VISIT}');
  `);
});

async function asRole<T>(role: "anon" | "authenticated", fn: () => Promise<T>) {
  await db.exec(`SET ROLE ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec("RESET ROLE");
  }
}

describe("communication_logs migration", () => {
  it("stores a snapshot, then allows status and provider id updates only", async () => {
    const inserted = await db.query<{ id: string }>(
      `
        INSERT INTO public.communication_logs (
          channel, notification_type, audience, customer_id, visit_id,
          appointment_ids, pet_ids, recipient, subject, body_text, body_html,
          provider, status, idempotency_key
        ) VALUES (
          'email', 'receipt', 'customer', $1, $2,
          ARRAY[$3]::uuid[], ARRAY[$4]::uuid[],
          'penny@example.com', 'Your receipt', 'Total $80',
          '<p>Total $80</p>', 'resend', 'pending', 'receipt|once'
        )
        RETURNING id
      `,
      [CUSTOMER_A, VISIT, APPOINTMENT, PET],
    );
    const id = inserted.rows[0]?.id;
    assert.ok(id);

    await db.query(
      `
        UPDATE public.communication_logs
        SET status = 'accepted',
            provider_message_id = 're_123',
            accepted_at = now()
        WHERE id = $1
      `,
      [id],
    );
    const saved = await db.query<{
      status: string;
      provider_message_id: string;
      body_text: string;
    }>(
      `SELECT status, provider_message_id, body_text FROM public.communication_logs WHERE id = $1`,
      [id],
    );
    assert.equal(saved.rows[0]?.status, "accepted");
    assert.equal(saved.rows[0]?.provider_message_id, "re_123");
    assert.equal(saved.rows[0]?.body_text, "Total $80");

    await assert.rejects(
      () =>
        db.query(
          `UPDATE public.communication_logs SET body_text = 'changed later' WHERE id = $1`,
          [id],
        ),
      (error: unknown) => {
        assert.match(String(error), /communication log snapshot is immutable/);
        return true;
      },
    );
    await assert.rejects(
      () =>
        db.query(
          `UPDATE public.communication_logs SET subject = 'new subject' WHERE id = $1`,
          [id],
        ),
      (error: unknown) => {
        assert.match(String(error), /immutable/);
        return true;
      },
    );

    await db.exec("SET ROLE service_role");
    try {
      await db.query(
        `
          UPDATE public.communication_logs
          SET status = 'delivered',
              delivered_at = now()
          WHERE id = $1
        `,
        [id],
      );
    } finally {
      await db.exec("RESET ROLE");
    }
    const delivered = await db.query<{ status: string; body_text: string }>(
      `SELECT status, body_text FROM public.communication_logs WHERE id = $1`,
      [id],
    );
    assert.equal(delivered.rows[0]?.status, "delivered");
    assert.equal(delivered.rows[0]?.body_text, "Total $80");

    await assert.rejects(
      () =>
        db.exec(`
          INSERT INTO public.communication_logs (
            channel, notification_type, recipient, body_text, status, idempotency_key
          ) VALUES (
            'sms', 'receipt', '+15615550100', 'again', 'pending', 'receipt|once'
          )
        `),
      (error: unknown) => {
        assert.match(String(error), /communication_logs_idempotency_key_unique|duplicate key/);
        return true;
      },
    );
  });

  it("lets staff read logs and blocks anon, customers, and customer inserts", async () => {
    await asRole("anon", async () => {
      await assert.rejects(
        () => db.query(`SELECT id FROM public.communication_logs`),
        (error: unknown) => {
          assert.match(String(error), /permission denied/i);
          return true;
        },
      );
    });

    await asRole("authenticated", async () => {
      const hidden = await db.query(`SELECT id FROM public.communication_logs`);
      assert.equal(hidden.rows.length, 0);
      await assert.rejects(
        () =>
          db.exec(`
            INSERT INTO public.communication_logs (
              channel, notification_type, recipient, body_text, status, idempotency_key
            ) VALUES (
              'sms', 'receipt', '+15615550111', 'nope', 'pending', 'customer-insert'
            )
          `),
        (error: unknown) => {
          assert.match(String(error), /permission denied/i);
          return true;
        },
      );
    });

    await db.query(`UPDATE private.staff_probe SET enabled = true`);
    try {
      await asRole("authenticated", async () => {
        const visible = await db.query<{ customer_id: string }>(
          `SELECT customer_id FROM public.communication_logs`,
        );
        assert.equal(visible.rows.length > 0, true);
        assert.equal(
          visible.rows.every((row) => row.customer_id === CUSTOMER_A),
          true,
        );
      });
    } finally {
      await db.query(`UPDATE private.staff_probe SET enabled = false`);
    }
  });

  it("does not grant customers a way to read another customer's row", async () => {
    await db.query(
      `
        INSERT INTO public.communication_logs (
          channel, notification_type, customer_id, recipient, body_text, status, idempotency_key
        ) VALUES (
          'sms', 'thank_you', $1, '+15615550199', 'private note', 'accepted', 'other-customer'
        )
      `,
      [CUSTOMER_B],
    );

    await asRole("authenticated", async () => {
      const rows = await db.query(
        `SELECT id FROM public.communication_logs WHERE customer_id = $1`,
        [CUSTOMER_B],
      );
      assert.equal(rows.rows.length, 0);
    });
  });
});
