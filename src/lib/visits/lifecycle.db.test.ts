import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, after, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { buildVisitBill } from "@/lib/charges/visit-bill";

const V = "11111111-1111-4111-8111-111111111111";
const W = "22222222-2222-4222-8222-222222222222";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let db: PGlite;
before(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE public.visits(id uuid primary key, status text default 'confirmed');
    CREATE TABLE public.appointments(id uuid primary key, visit_id uuid, status text default 'confirmed',
      service_id text default 'full-groom', service_started_at timestamptz, service_ended_at timestamptz);
    INSERT INTO public.visits(id) VALUES ('${V}'), ('${W}');
    INSERT INTO public.appointments(id,visit_id) VALUES ('${A}','${V}'), ('${B}','${V}');`);
  await db.exec(readFileSync(new URL("../../../supabase/migrations/20261028180520_visit_lifecycle.sql", import.meta.url), "utf8"));
});
after(async () => { await db?.close(); });
async function timing(action: string, visit = V, hourly: string[] = []) {
  const result = await db.query<{ timing: { startedAt: string; endedAt: string | null } }>(
    "select public.staff_set_visit_lifecycle($1,$2,$3) as timing", [visit, action, hourly]);
  return result.rows[0].timing;
}
it("rejects checkout before arrival without changing child clocks", async () => {
  await assert.rejects(timing("check_out"), /Check in first/);
});
it("one arrival and departure applies to the visit, is idempotent, and leaves dog timers intact", async () => {
  const started = await timing("check_in");
  assert.equal((await timing("check_in")).startedAt, started.startedAt);
  const ended = await timing("check_out");
  assert.ok(ended.endedAt);
  assert.deepEqual(await timing("check_out"), ended);
  assert.deepEqual(await timing("check_in"), ended);
  const rows = await db.query<{ service_started_at: string | null; service_ended_at: string | null }>("select service_started_at,service_ended_at from appointments");
  assert.ok(rows.rows.every(row => row.service_started_at === null && row.service_ended_at !== null));
  const bill = buildVisitBill({ visitId: V, customerName: "One owner", serviceDate: "2026-10-28",
    arrivalLabel: "9 AM", travelFee: 15,
    pets: rows.rows.map((row, i) => ({ appointmentId: i === 0 ? A : B,
      petName: i === 0 ? "Valentino" : "Stella", serviceName: "Full Groom", servicePrice: 200,
      status: "confirmed", serviceEndedAt: row.service_ended_at })),
  });
  assert.equal(bill.blocked, false);
  assert.equal(bill.servicedDogCount, 2);
  assert.equal(bill.subtotal, 415);
});
it("does not start a different visit belonging to the same customer", async () => {
  const { rows } = await db.query<{ service_started_at: string | null }>("select service_started_at from visits where id=$1", [W]);
  assert.equal(rows[0].service_started_at, null);
});
it("hourly services must finish their own timers before household departure", async () => {
  await db.exec(`UPDATE appointments SET visit_id='${W}',service_id='hand-stripping',service_started_at=null,service_ended_at=null WHERE id='${A}';`);
  await timing("check_in", W);
  await assert.rejects(timing("check_out", W, ["hand-stripping"]), /Finish hourly/);
  await db.exec(`UPDATE appointments SET service_started_at=now()-interval '1 hour',service_ended_at=now() WHERE id='${A}';`);
  const before = await db.query("select service_started_at,service_ended_at from appointments where id=$1", [A]);
  assert.ok((await timing("check_out", W, ["hand-stripping"])).endedAt);
  assert.deepEqual((await db.query("select service_started_at,service_ended_at from appointments where id=$1", [A])).rows, before.rows);
});
it("cancelled dogs do not block departure; empty visits cannot be operated", async () => {
  await db.exec(`UPDATE visits SET service_ended_at=null WHERE id='${W}'; UPDATE appointments SET status='cancelled',service_ended_at=null WHERE id='${A}';
    UPDATE appointments SET visit_id='${W}' WHERE id='${B}';`);
  assert.ok((await timing("check_out", W, ["hand-stripping"])).endedAt);
  await db.exec(`UPDATE appointments SET status='cancelled' WHERE id='${B}';`);
  await assert.rejects(timing("check_in", W), /No active dogs/);
});
it("visitors and customers cannot call the staff mutation", async () => {
  const result = await db.query<{ role: string; allowed: boolean }>(`select role,has_function_privilege(role,'public.staff_set_visit_lifecycle(uuid,text,text[])','execute') as allowed
    from unnest(array['anon','authenticated','service_role']) role`);
  assert.deepEqual(result.rows.map(row => row.allowed), [false, false, true]);
});
