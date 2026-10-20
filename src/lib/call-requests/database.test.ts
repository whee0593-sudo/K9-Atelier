import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(new URL("../../../supabase/migrations/20261020140839_call_requests.sql", import.meta.url), "utf8");
async function database() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),email text,stripe_customer_id text UNIQUE);
    CREATE TABLE public.payment_methods(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),customer_id uuid REFERENCES public.profiles(id),stripe_payment_method_id text UNIQUE,brand text,last4 text,exp_month int,exp_year int,is_default bool);
    CREATE UNIQUE INDEX one_default ON public.payment_methods(customer_id) WHERE is_default;
    GRANT SELECT,INSERT,UPDATE ON public.profiles,public.payment_methods TO service_role;`);
  await db.exec(migration); return db;
}
describe("callback database isolation", () => {
  it("denies all guest/customer table access and guest RPC execution", async () => {
    const db = await database();
    try {
      for (const role of ["anon", "authenticated"]) {
        await db.exec(`SET ROLE ${role}`);
        for (const query of ["SELECT * FROM public.call_requests", "DELETE FROM public.call_requests", "UPDATE public.call_requests SET status='contacted'", "INSERT INTO public.call_requests DEFAULT VALUES", "SELECT public.create_call_request_draft(repeat('a',64),repeat('b',64))"]) await assert.rejects(db.exec(query), /permission denied/);
        await db.exec("RESET ROLE");
      }
      await db.exec("INSERT INTO public.call_requests(token_hash,ip_hash) VALUES(repeat('a',64),repeat('b',64)); GRANT SELECT ON public.call_requests TO anon; SET ROLE anon");
      assert.equal((await db.query("SELECT * FROM public.call_requests")).rows.length, 0);
      await db.exec("RESET ROLE");
    } finally { await db.close(); }
  });
  it("limits draft creation durably and cannot mark an unsaved card as received", async () => {
    const db = await database();
    try {
      await db.exec("SET ROLE service_role");
      for (let i = 0; i < 5; i++) await db.query("SELECT public.create_call_request_draft($1,$2)", [String(i).repeat(64), "b".repeat(64)]);
      await assert.rejects(db.query("SELECT public.create_call_request_draft($1,$2)", ["f".repeat(64), "b".repeat(64)]), /call_request_rate_limit/);
      await assert.rejects(db.exec("UPDATE public.call_requests SET status='requested'"), /check constraint/);
      const rows = await db.query<{ count: number }>("SELECT count(*)::int count FROM public.call_requests");
      assert.equal(rows.rows[0].count, 5);
    } finally { await db.close(); }
  });
  it("links a verified request atomically and idempotently without replacing another customer’s cards", async () => {
    const db = await database();
    try {
      const r = await db.query<{ id: string }>(`INSERT INTO public.call_requests(token_hash,ip_hash,status,name,phone,consent_at,consent_version,stripe_customer_id,stripe_setup_intent_id,stripe_payment_method_id,card_brand,card_last4,card_exp_month,card_exp_year,requested_at)
        VALUES(repeat('a',64),repeat('b',64),'requested','Pat Smith','+15615933335',now(),'2026-10-20','cus_call','seti_call','pm_call','visa','4242',12,2030,now()) RETURNING id`);
      await db.exec("INSERT INTO public.profiles(email) VALUES('pat@example.com'); INSERT INTO public.profiles(email,stripe_customer_id) VALUES('other@example.com','cus_existing')");
      await db.exec("SET ROLE service_role");
      const id = r.rows[0].id;
      await assert.rejects(db.query("SELECT public.link_call_request_customer($1,'other@example.com')", [id]), /different_stripe_customer/);
      await db.query("SELECT public.link_call_request_customer($1,'pat@example.com')", [id]);
      await db.query("SELECT public.link_call_request_customer($1,'pat@example.com')", [id]);
      assert.equal((await db.query<{ count: number }>("SELECT count(*)::int count FROM public.payment_methods")).rows[0].count, 1);
      assert.equal((await db.query<{ stripe_customer_id: string }>("SELECT stripe_customer_id FROM public.profiles WHERE email='other@example.com'")).rows[0].stripe_customer_id, "cus_existing");
      await db.exec("RESET ROLE; DELETE FROM public.payment_methods WHERE stripe_payment_method_id='pm_call'; SET ROLE service_role");
      await db.query("SELECT public.link_call_request_customer($1,'pat@example.com')", [id]);
      assert.equal((await db.query<{ count: number }>("SELECT count(*)::int count FROM public.payment_methods")).rows[0].count, 0);
    } finally { await db.close(); }
  });
});
