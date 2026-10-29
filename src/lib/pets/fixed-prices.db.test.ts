import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before,after,it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
let db:PGlite;
const A="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", B="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", S="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const P="11111111-1111-4111-8111-111111111111", Q="22222222-2222-4222-8222-222222222222";
before(async()=>{
  db=new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid primary key);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth,public TO authenticated,service_role;
    CREATE TABLE public.pets(id uuid primary key,customer_id uuid,archived_at timestamptz);
    GRANT SELECT ON public.pets TO authenticated; GRANT ALL ON public.pets TO service_role;
    INSERT INTO auth.users VALUES ('${A}'),('${B}'),('${S}');
    INSERT INTO pets VALUES ('${P}','${A}',null),('${Q}','${B}',null);`);
  await db.exec(readFileSync(new URL("../../../supabase/migrations/20261029000311_pet_service_prices.sql",import.meta.url),"utf8"));
  await db.query("INSERT INTO pet_service_prices(pet_id,service_id,amount,updated_by) VALUES ($1,'custom-full-haircut',200,$3),($2,'custom-full-haircut',180,$3)",[P,Q,S]);
});
after(async()=>{await db?.close();});
async function query(role:string,user:string,sql:string,params:unknown[]=[]){
  await db.exec("BEGIN; SET LOCAL ROLE "+role);
  try { await db.query("select set_config('request.jwt.claim.sub',$1,true)",[user]); const result=await db.query(sql,params); await db.exec("COMMIT"); return result; }
  catch(error){ await db.exec("ROLLBACK"); throw error; }
}
it("lets owners read only their own dog's prices",async()=>{
  assert.deepEqual((await query("authenticated",A,"select pet_id from pet_service_prices")).rows,[{pet_id:P}]);
  assert.deepEqual((await query("authenticated",B,"select pet_id from pet_service_prices")).rows,[{pet_id:Q}]);
  assert.equal((await query("authenticated",S,"select * from pet_service_prices")).rows.length,0);
});
it("blocks customer and anonymous price changes and hides audit records",async()=>{
  await assert.rejects(query("authenticated",A,"update pet_service_prices set amount=1 where pet_id=$1",[P]),/permission denied/);
  await assert.rejects(query("authenticated",A,"insert into pet_service_prices(pet_id,service_id,amount,updated_by) values ($1,'signature-bath-care',1,$2)",[P,A]),/permission denied/);
  await assert.rejects(query("authenticated",A,"delete from pet_service_prices where pet_id=$1",[P]),/permission denied/);
  await assert.rejects(query("anon",A,"select * from pet_service_prices"),/permission denied/);
  await assert.rejects(query("authenticated",A,"select * from pet_service_price_events"),/permission denied/);
});
it("audits staff price changes and allows restoring standard pricing",async()=>{
  await query("service_role",S,"update pet_service_prices set amount=225,updated_by=$2 where pet_id=$1",[P,S]);
  const changed=await query("service_role",S,"select previous_amount::text,amount::text,actor_id from pet_service_price_events where pet_id=$1 order by id desc limit 1",[P]);
  assert.deepEqual(changed.rows,[{previous_amount:"200",amount:"225",actor_id:S}]);
  await query("service_role",S,"update pet_service_prices set amount=null,updated_by=$2 where pet_id=$1",[P,S]);
  assert.deepEqual((await query("service_role",S,"select amount from pet_service_prices where pet_id=$1",[P])).rows,[{amount:null}]);
});
it("rejects negative, excessive and fractional-cent prices in the database",async()=>{
  for(const amount of [-1,5000.01,12.345]) await assert.rejects(query("service_role",S,"update pet_service_prices set amount=$2 where pet_id=$1",[P,amount]),/check constraint/);
});

it("records one real change for an upsert and no change for an identical retry",async()=>{
  const count=async()=>Number((await db.query<{count:string}>("select count(*)::text as count from pet_service_price_events where pet_id=$1",[Q])).rows[0].count);
  const before=await count();
  const sql="insert into pet_service_prices(pet_id,service_id,amount,updated_by) values ($1,'custom-full-haircut',195,$2) on conflict(pet_id,service_id) do update set amount=excluded.amount,updated_by=excluded.updated_by";
  await query("service_role",S,sql,[Q,S]);assert.equal(await count(),before+1);
  const latest=await db.query("select previous_amount::text,amount::text from pet_service_price_events where pet_id=$1 order by id desc limit 1",[Q]);
  assert.deepEqual(latest.rows,[{previous_amount:"180",amount:"195"}]);
  await query("service_role",S,sql,[Q,S]);assert.equal(await count(),before+1);
});
