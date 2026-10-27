import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { it } from "node:test";
import { PGlite } from "@electric-sql/pglite";

it("permits customer allergy fields while retaining ownership and card-account restrictions", async () => {
  const db = new PGlite();
  const directory = path.join(process.cwd(), "supabase/migrations");
  const fix = "20261020191652_booking_allergy_field_permissions.sql";
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
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
    for (const file of readdirSync(directory).filter(f => f.endsWith(".sql") && f !== fix).sort()) {
      await db.exec(readFileSync(path.join(directory, file), "utf8"));
    }
    const own = "11111111-1111-4111-8111-111111111111";
    const other = "22222222-2222-4222-8222-222222222222";
    await db.query("INSERT INTO auth.users(id,email) VALUES($1,'qa-own@example.com'),($2,'qa-other@example.com')", [own, other]);
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${own}';`);
    await assert.rejects(db.query("UPDATE public.profiles SET household_allergy_status='none' WHERE id=$1", [own]), /permission denied/);
    await db.exec("RESET ROLE");
    await db.exec(readFileSync(path.join(directory, fix), "utf8"));
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${own}';`);
    await db.query("UPDATE public.profiles SET household_allergy_status='yes',household_allergy_details='Test fragrance sensitivity' WHERE id=$1", [own]);
    const pet = await db.query<{id:string}>("INSERT INTO public.pets(name,breed,weight_lbs,allergy_status,allergy_details) VALUES('QA Coco','Poodle',12,'none',NULL) RETURNING id");
    await db.query("UPDATE public.pets SET allergy_status='unsure',allergy_details=NULL WHERE id=$1", [pet.rows[0].id]);
    const cross = await db.query("UPDATE public.profiles SET household_allergy_status='none' WHERE id=$1 RETURNING id", [other]);
    assert.equal(cross.rows.length, 0);
    await assert.rejects(db.query("UPDATE public.profiles SET stripe_customer_id='cus_other' WHERE id=$1", [own]), /permission denied/);
    await db.exec("RESET ROLE");
    const saved = await db.query<{household_allergy_status:string}>("SELECT household_allergy_status FROM public.profiles WHERE id=$1", [own]);
    assert.equal(saved.rows[0].household_allergy_status, "yes");
    await db.exec("SET ROLE anon");
    await assert.rejects(db.query("UPDATE public.profiles SET household_allergy_status='none' WHERE id=$1", [own]), /permission denied/);
  } finally {
    await db.close();
  }
});
