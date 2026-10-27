import assert from "node:assert/strict";
import { before, after, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { guestBookingFixtureSql } from "@/lib/appointments/test-fixtures/guest-booking";

const CUSTOMER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PET = "11111111-1111-4111-8111-111111111111";
const PET2 = "11111111-1111-4111-8111-111111111112";
const PET3 = "11111111-1111-4111-8111-111111111113";
const CARD = "22222222-2222-4222-8222-222222222222";
const KEY = "33333333-3333-4333-8333-333333333333";
const KEY2 = "33333333-3333-4333-8333-333333333334";
const sql = (file: string) =>
  readFileSync(`supabase/migrations/${file}`, "utf8");
function definition(file: string, name: string) {
  const source = sql(file);
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION ${name}(`);
  assert.notEqual(start, -1);
  const end = source.indexOf("$$;", start) + 3;
  return source.slice(start, end);
}
let db: PGlite;
function payload(start = 540) {
  const visit = {
    customer_id: CUSTOMER,
    service_date: "2026-11-02",
    scheduled_start: start,
    time_preference: "morning",
    timezone: "America/New_York",
    status: "confirmed",
    address_street: "100 Olive Ave",
    address_city: "West Palm Beach",
    address_state: "FL",
    address_zip: "33401",
    address_lat: 26.72,
    address_lon: -80.05,
    travel_distance_miles: 12,
    travel_fee: 13,
    travel_fee_automatic: 13,
    travel_fee_override: null,
  };
  const appointments = [PET, PET2, PET3].map((pet_id, index) => ({
    ...visit,
    pet_id,
    appointment_date: visit.service_date,
    scheduled_start: start + 60 * index,
    visit_sequence: index + 1,
    service_id: "signature-bath-care",
    service_name: "Signature Bath",
    estimated_duration_minutes: 60,
    add_on_ids: index === 0 ? ["mini-trim"] : [],
    add_on_options: {},
    spa_goals: [],
    allergy_snapshot: null,
    travel_fee: index === 0 ? 13 : 0,
    service_price: 90,
    estimated_total: index === 0 ? 103 : 90,
    new_client_deposit: 0,
    payment_method_id: CARD,
    vaccination_status_at_booking: "missing",
    staff_created: false,
  }));
  return { visit, appointments };
}
async function book(key = KEY, hash = "same", data = payload()) {
  await db.exec("SET ROLE service_role");
  try {
    return await db.query<{
      result: { created: boolean; appointment_id: string };
    }>(
      "SELECT public.create_guest_group_booking($1::uuid, $2, $3::jsonb, $4::jsonb) AS result",
      [
        key,
        hash,
        JSON.stringify(data.visit),
        JSON.stringify(data.appointments),
      ],
    );
  } finally {
    await db.exec("RESET ROLE");
  }
}
before(async () => {
  db = new PGlite();
  await db.exec(guestBookingFixtureSql());
  await db.exec(`CREATE SCHEMA private;
    ALTER TABLE appointments ADD spa_goals text[], ADD allergy_snapshot jsonb;
    ALTER TABLE visits ADD travel_fee_automatic numeric, ADD travel_fee_override numeric;
    INSERT INTO pets (id, customer_id) VALUES ('${PET2}', '${CUSTOMER}'), ('${PET3}', '${CUSTOMER}');
    GRANT SELECT ON pets, payment_methods TO service_role;
    GRANT USAGE ON SCHEMA private TO service_role;`);
  await db.exec(sql("20261015190000_guest_booking_idempotency.sql"));
  await db.exec(
    definition(
      "20261007140000_visit_integrity.sql",
      "public.visit_arrival_label",
    ),
  );
  await db.exec(
    definition(
      "20261017120000_booking_services_phase1.sql",
      "public.create_staff_visit",
    ),
  );
  await db.exec(
    definition(
      "20261026153942_visit_travel_fee_override.sql",
      "private.mirror_visit_travel_fee",
    ),
  );
  await db.exec(
    definition(
      "20261026153942_visit_travel_fee_override.sql",
      "public.create_staff_visit_with_travel_fee",
    ),
  );
  await db.exec(sql("20261027120317_guest_group_booking.sql"));
});
after(async () => {
  await db.close();
});

describe("atomic customer multi-dog visits", () => {
  it("saves three dogs consecutively on one visit and charges travel once", async () => {
    const result = await book();
    assert.equal(result.rows[0].result.created, true);
    const { rows } = await db.query<{
      count: number;
      visits: number;
      fee: number;
    }>(
      "SELECT count(*)::int AS count, count(DISTINCT visit_id)::int AS visits, sum(travel_fee)::int AS fee FROM appointments",
    );
    assert.deepEqual(rows[0], { count: 3, visits: 1, fee: 13 });
    const starts = await db.query<{ scheduled_start: number }>(
      "SELECT scheduled_start FROM appointments ORDER BY visit_sequence",
    );
    assert.deepEqual(
      starts.rows.map((row) => row.scheduled_start),
      [540, 600, 660],
    );
    const retry = await book();
    assert.deepEqual(retry.rows[0].result, {
      ...result.rows[0].result,
      created: false,
    });
    await assert.rejects(book(KEY, "changed"), /idempotency_mismatch/);
  });
  it("blocks a start inside an existing dog's occupied duration and rolls back the claim", async () => {
    await assert.rejects(
      book(KEY2, "overlap", payload(570)),
      /slot_unavailable/,
    );
    const { rows } = await db.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM guest_booking_requests WHERE idempotency_key = $1",
      [KEY2],
    );
    assert.equal(rows[0].count, 0);
  });
  it("also blocks a stale single-dog booking inside the group's occupied time", async () => {
    const data = payload(570);
    await assert.rejects(
      db.query(
        "SELECT public.create_guest_booking($1::uuid, $2, $3::jsonb, $4::jsonb)",
        [
          KEY2,
          "single",
          JSON.stringify(data.visit),
          JSON.stringify(data.appointments[0]),
        ],
      ),
      /slot_unavailable/,
    );
    assert.equal((await db.query("SELECT * FROM visits")).rows.length, 1);
    assert.equal(
      (
        await db.query(
          "SELECT * FROM guest_booking_requests WHERE idempotency_key = $1",
          [KEY2],
        )
      ).rows.length,
      0,
    );
  });
  it("rejects another household's dog or card without creating partial visits", async () => {
    const badDog = payload(780);
    badDog.appointments[2].pet_id = "99999999-9999-4999-8999-999999999999";
    await assert.rejects(book(KEY2, "foreign", badDog), /pet_not_found/);
    const badCard = payload(780);
    badCard.appointments[2].payment_method_id =
      "99999999-9999-4999-8999-999999999999";
    await assert.rejects(book(KEY2, "foreign", badCard), /payment_required/);
    const { rows } = await db.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM visits",
    );
    assert.equal(rows[0].count, 1);
  });
  it("rolls back the whole visit if the final dog insert fails", async () => {
    const bad = payload(780);
    bad.appointments[2].service_name = null as unknown as string;
    await assert.rejects(book(KEY2, "last-fails", bad), /not-null|null value/i);
    const { rows } = await db.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM appointments",
    );
    assert.equal(rows[0].count, 3);
    assert.equal(
      (
        await db.query(
          "SELECT * FROM guest_booking_requests WHERE idempotency_key = $1",
          [KEY2],
        )
      ).rows.length,
      0,
    );
  });
  it("requires consecutive starts and does not allow duplicate dogs", async () => {
    const gap = payload(780);
    gap.appointments[1].scheduled_start += 5;
    await assert.rejects(book(KEY2, "gap", gap), /invalid group sequence/);
    const duplicate = payload(780);
    duplicate.appointments[2].pet_id = PET;
    await assert.rejects(book(KEY2, "duplicate", duplicate), /duplicate dog/);
  });
  it("denies direct execution to visitors and authenticated customers", async () => {
    const { rows } = await db.query<{
      anon: boolean;
      customer: boolean;
      service: boolean;
    }>(`
      SELECT has_function_privilege('anon', 'public.create_guest_group_booking(uuid,text,jsonb,jsonb)', 'EXECUTE') AS anon,
        has_function_privilege('authenticated', 'public.create_guest_group_booking(uuid,text,jsonb,jsonb)', 'EXECUTE') AS customer,
        has_function_privilege('service_role', 'public.create_guest_group_booking(uuid,text,jsonb,jsonb)', 'EXECUTE') AS service`);
    assert.deepEqual(rows[0], { anon: false, customer: false, service: true });
  });
});
