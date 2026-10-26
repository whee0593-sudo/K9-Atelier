import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, after, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";

let db: PGlite;
const visit = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const dog = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
before(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE SCHEMA private;
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE visits(id uuid PRIMARY KEY, status text DEFAULT 'confirmed', travel_fee numeric DEFAULT 0);
    ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
    GRANT INSERT, SELECT ON visits TO authenticated;
    CREATE POLICY visits_insert_own ON visits FOR INSERT TO authenticated WITH CHECK (true);
    CREATE TABLE appointments(id uuid PRIMARY KEY, visit_id uuid, status text DEFAULT 'confirmed',
      visit_sequence int, travel_fee numeric DEFAULT 0, estimated_total numeric,
      add_on_options jsonb DEFAULT '{}', service_id text, service_name text, add_on_ids text[],
      estimated_duration_minutes int);
    CREATE TABLE appointment_charges(visit_id uuid, appointment_id uuid, status text,
      kind text, line_items jsonb DEFAULT '[]');
    CREATE FUNCTION create_staff_visit(p_visit jsonb, p_appointments jsonb) RETURNS uuid
      LANGUAGE plpgsql AS $$ BEGIN
        INSERT INTO public.visits(id, travel_fee) VALUES ('${visit}', (p_visit->>'travel_fee')::numeric);
        INSERT INTO public.appointments(id, visit_id, visit_sequence, estimated_total, travel_fee)
          VALUES ('${dog}', '${visit}', 0, 80 + (p_visit->>'travel_fee')::numeric, (p_visit->>'travel_fee')::numeric),
          ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '${visit}', 1, 100, 0);
        RETURN '${visit}'::uuid;
      END $$;
  `);
  await db.exec(readFileSync("supabase/migrations/20261026153942_visit_travel_fee_override.sql", "utf8"));
});
after(async () => { await db?.close(); });

describe("travel override transaction in Postgres", () => {
  it("saves a staff booking waiver as zero rather than automatic", async () => {
    await assert.rejects(db.query(`SELECT create_staff_visit_with_travel_fee($1::jsonb, '[]')`,
      [JSON.stringify({ travel_fee: 0, travel_fee_automatic: 33, travel_fee_override: -1 })]));
    assert.equal((await db.query("SELECT * FROM visits")).rows.length, 0);
    assert.equal((await db.query("SELECT * FROM appointments")).rows.length, 0);
    await db.query(`SELECT create_staff_visit_with_travel_fee($1::jsonb, '[]')`,
      [JSON.stringify({ travel_fee: 0, travel_fee_automatic: 33, travel_fee_override: 0 })]);
    const row = (await db.query("SELECT travel_fee, travel_fee_automatic, travel_fee_override FROM visits")).rows[0];
    assert.deepEqual(row, { travel_fee: "0", travel_fee_automatic: "33.00", travel_fee_override: "0.00" });
  });
  it("updates one mirror, totals and stored line items atomically, then restores automatic", async () => {
    await db.exec(`UPDATE appointments SET add_on_options = jsonb_build_object('__visitLineItems',
      jsonb_build_array(jsonb_build_object('id','service','label','Bath','amount',estimated_total,'catalogId','bath')))`);
    for (const override of [12.25, 0, null]) {
      await db.query("SELECT set_visit_travel_fee($1, 33, $2)", [visit, override]);
      const fee = override ?? 33;
      const totals = (await db.query<{ travel: string; total: string }>(
        "SELECT sum(travel_fee)::text travel, sum(estimated_total)::text total FROM appointments")).rows[0]!;
      assert.equal(Number(totals.travel), fee);
      assert.equal(Number(totals.total), 180 + fee);
      const stored = (await db.query<{ amount: string; count: number }>(`SELECT COALESCE(sum((item->>'amount')::numeric),0)::text amount, count(*)::int count
        FROM appointments a, jsonb_array_elements(a.add_on_options->'__visitLineItems') item WHERE item->>'catalogId'='travel-fee'`)).rows[0]!;
      assert.equal(Number(stored.amount), fee);
      assert.equal(stored.count, fee > 0 ? 1 : 0);
    }
  });
  it("rejects malformed values and rolls back every amount", async () => {
    for (const invalid of [-1, 5001, 1.234]) {
      await assert.rejects(db.query("SELECT set_visit_travel_fee($1,33,$2)", [visit, invalid]));
    }
    assert.equal(Number((await db.query<{ travel_fee: string }>("SELECT travel_fee FROM visits")).rows[0]!.travel_fee), 33);
    await db.exec("ALTER TABLE appointments ADD CONSTRAINT test_total_limit CHECK (estimated_total < 200)");
    try {
      await assert.rejects(db.query("SELECT set_visit_travel_fee($1,33,500)", [visit]), /test_total_limit/);
      assert.equal(Number((await db.query<{ travel_fee: string }>("SELECT travel_fee FROM visits")).rows[0]!.travel_fee), 33);
      assert.equal(Number((await db.query<{ total: string }>("SELECT sum(estimated_total) total FROM appointments")).rows[0]!.total), 213);
    } finally { await db.exec("ALTER TABLE appointments DROP CONSTRAINT test_total_limit"); }
  });
  it("moves the single fee and its total when the carrier dog is cancelled", async () => {
    await db.query("UPDATE appointments SET status='cancelled' WHERE id=$1", [dog]);
    await db.query("SELECT sync_visit_travel_fee($1)", [visit]);
    const cancelled = (await db.query<{ travel_fee: string; estimated_total: string }>("SELECT travel_fee,estimated_total FROM appointments WHERE id=$1", [dog])).rows[0]!;
    assert.equal(Number(cancelled.travel_fee), 0);
    assert.equal(Number(cancelled.estimated_total), 80);
    const active = (await db.query<{ travel_fee: string; estimated_total: string }>("SELECT travel_fee,estimated_total FROM appointments WHERE status <> 'cancelled'")).rows[0]!;
    assert.equal(Number(active.travel_fee), 33);
    assert.equal(Number(active.estimated_total), 133);
    await db.query("UPDATE appointments SET status='confirmed' WHERE id=$1", [dog]);
  });
  it("dog service edits preserve the visit override even when their travel input is different", async () => {
    await db.query("SELECT set_visit_travel_fee($1,33,0)", [visit]);
    await db.query("SELECT apply_visit_service_change($1,$2,$3::jsonb,null,null,null,null)",
      [dog, visit, JSON.stringify({ service_id: "bath", estimated_total: 80, appointment_travel_fee: 0, travel_fee: 999 })]);
    const row = (await db.query("SELECT travel_fee, travel_fee_override FROM visits")).rows[0];
    assert.deepEqual(row, { travel_fee: "0", travel_fee_override: "0.00" });
  });
  it("rejects stale or duplicate travel at checkout and locks changes after payment starts", async () => {
    await assert.rejects(db.query(`INSERT INTO appointment_charges VALUES ($1,$2,'pending','service',$3::jsonb)`,
      [visit, dog, JSON.stringify([{ catalogId: "travel-fee", amount: 33 }])]));
    await assert.rejects(db.query(`INSERT INTO appointment_charges VALUES ($1,$2,'pending','service',$3::jsonb)`,
      [visit, dog, JSON.stringify([{ catalogId: "travel-fee", amount: 0 }, { catalogId: "travel-fee", amount: 0 }])]));
    await db.query("INSERT INTO appointment_charges VALUES ($1,$2,'pending','service','[]')", [visit, dog]);
    await assert.rejects(db.query("SELECT set_visit_travel_fee($1,33,null)", [visit]), /Payment already started/);
    await db.exec("UPDATE appointment_charges SET status='paid'");
    await assert.rejects(db.query("SELECT set_visit_travel_fee($1,33,12)", [visit]), /Payment already started/);
  });
  it("denies customers and anonymous callers the mutation RPCs", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`SET ROLE ${role}`);
      try {
        await assert.rejects(db.query("SELECT set_visit_travel_fee($1,33,0)", [visit]), /permission denied/);
        await assert.rejects(db.query("SELECT create_staff_visit_with_travel_fee('{}','[]')"), /permission denied/);
      } finally { await db.exec("RESET ROLE"); }
    }
  });
  it("rejects direct customer inserts of override metadata via RLS", async () => {
    await db.exec("SET ROLE authenticated");
    try {
      await assert.rejects(db.query("INSERT INTO visits(id,travel_fee_override) VALUES (gen_random_uuid(),0)"), /row-level security/);
      await assert.rejects(db.query("INSERT INTO visits(id,travel_fee_automatic) VALUES (gen_random_uuid(),33)"), /row-level security/);
      await db.query("INSERT INTO visits(id) VALUES (gen_random_uuid())");
    } finally { await db.exec("RESET ROLE"); }
  });
});
