import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, beforeEach, after, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";

let db: PGlite;
const owner="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", visit="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const first="cccccccc-cccc-4ccc-8ccc-cccccccccccc", second="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const hash="a".repeat(64);
const address={street:"123 Palm Lane",city:"Jupiter",state:"FL",zip:"33458"};
before(async()=>{
  db=new PGlite();
  await db.exec(`CREATE SCHEMA private; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE visits(id uuid PRIMARY KEY, customer_id uuid, status text, travel_fee numeric DEFAULT 0,
      address_street text, address_city text, address_state text, address_zip text,
      address_lat float8,address_lon float8,travel_distance_miles numeric);
    CREATE TABLE appointments(id uuid PRIMARY KEY,visit_id uuid,customer_id uuid,status text,staff_created boolean,
      customer_confirm_token_hash text,customer_confirm_expires_at timestamptz,
      address_street text,address_city text,address_state text,address_zip text,
      address_lat float8,address_lon float8,travel_distance_miles numeric,
      visit_sequence int,travel_fee numeric DEFAULT 0,estimated_total numeric,add_on_options jsonb DEFAULT '{}',
      service_id text,service_name text,add_on_ids text[],estimated_duration_minutes int);
    CREATE TABLE appointment_charges(visit_id uuid,appointment_id uuid,status text,kind text,line_items jsonb DEFAULT '[]');
    CREATE FUNCTION create_staff_visit(jsonb,jsonb) RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
    ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
  `);
  await db.exec(readFileSync("supabase/migrations/20261026153942_visit_travel_fee_override.sql","utf8"));
  await db.exec(readFileSync("supabase/migrations/20261106174639_complete_staff_booking_address.sql","utf8"));
});
beforeEach(async()=>{
  await db.exec(`TRUNCATE appointments,visits,appointment_charges;
    INSERT INTO visits(id,customer_id,status,address_street,address_city,address_state,address_zip) VALUES('${visit}','${owner}','pending_confirmation','','','FL','');
    INSERT INTO appointments(id,visit_id,customer_id,status,staff_created,customer_confirm_token_hash,customer_confirm_expires_at,address_street,address_city,address_state,address_zip,visit_sequence,estimated_total)
      VALUES('${first}','${visit}','${owner}','pending_confirmation',true,'${hash}',now()+interval '1 day','','','FL','',1,135.50),
      ('${second}','${visit}','${owner}','pending_confirmation',true,'${hash}',now()+interval '1 day','','','FL','',2,25);
  `);
});
after(async()=>{await db?.close();});
const save=(token=hash,customer=owner,fee=33)=>db.query("select complete_staff_booking_address($1,$2,$3,$4::jsonb,26.9,-80.1,15,$5)",[token,customer,first,JSON.stringify(address),fee]);
it("fills every service and visit and charges travel exactly once",async()=>{
  await save();
  const rows=(await db.query<{address_street:string;travel_fee:string;estimated_total:string}>("select address_street,travel_fee,estimated_total from appointments order by visit_sequence")).rows;
  assert.deepEqual(rows.map(row=>row.address_street),[address.street,address.street]);
  assert.deepEqual(rows.map(row=>Number(row.travel_fee)),[33,0]);
  assert.deepEqual(rows.map(row=>Number(row.estimated_total)),[168.5,25]);
  assert.equal((await db.query<{address_street:string}>("select address_street from visits")).rows[0].address_street,address.street);
  await save(hash,owner,99);
  assert.equal(Number((await db.query<{travel_fee:string}>("select travel_fee from visits")).rows[0].travel_fee),33);
});
it("preserves the administrator's explicit travel-fee waiver",async()=>{
  await db.exec("update visits set travel_fee_override=0");
  await save();
  const row=(await db.query<{travel_fee:string;travel_fee_automatic:string}>("select travel_fee,travel_fee_automatic from visits")).rows[0];
  assert.equal(Number(row.travel_fee),0); assert.equal(Number(row.travel_fee_automatic),33);
});
it("rejects invalid, expired and foreign-owner tokens without changing any address",async()=>{
  await assert.rejects(save("b".repeat(64)),/Confirmation link unavailable/);
  await assert.rejects(save(hash,"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"),/Visit unavailable/);
  await db.exec("update appointments set customer_confirm_expires_at=now()-interval '1 day'");
  await assert.rejects(save(),/Confirmation link unavailable/);
  assert.equal((await db.query<{address_street:string}>("select address_street from visits")).rows[0].address_street,"");
});
it("rolls back addresses and travel together if repricing fails",async()=>{
  await assert.rejects(save(hash,owner,-1),/Invalid travel fee/);
  assert.equal((await db.query<{address_street:string}>("select address_street from visits")).rows[0].address_street,"");
  assert.deepEqual((await db.query<{address_street:string}>("select address_street from appointments")).rows.map(row=>row.address_street),["",""]);
});
it("denies direct anonymous and customer execution",async()=>{
  for(const role of ["anon","authenticated"]){
    await db.exec("SET ROLE "+role);
    try{await assert.rejects(save(),/permission denied/);}finally{await db.exec("RESET ROLE");}
  }
});
