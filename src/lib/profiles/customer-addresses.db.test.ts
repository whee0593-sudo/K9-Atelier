import assert from "node:assert/strict";
import { before, after, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

let db: PGlite;
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
before(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA private; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE FUNCTION private.is_staff() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
    CREATE FUNCTION private.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
    GRANT USAGE ON SCHEMA public, private, auth TO authenticated;
    CREATE TABLE profiles(id uuid PRIMARY KEY);
    INSERT INTO profiles VALUES ('${owner}'),('${other}');
    CREATE TABLE appointments(id int PRIMARY KEY, customer_id uuid, address_street text, address_city text, address_state text, address_zip text);
    GRANT INSERT, SELECT ON appointments TO authenticated;
    INSERT INTO appointments VALUES (1,'${owner}','100 Palm Ave','Palm Beach','FL','33480'),(2,'${owner}','100 Palm Ave','Palm Beach','FL','33480');`);
  await db.exec(readFileSync("supabase/migrations/20261004020000_customer_service_addresses.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/20261030115424_customer_address_book.sql", "utf8"));
});
after(async () => { await db?.close(); });
describe("customer address book in Postgres", () => {
  it("backfills existing bookings once and remembers new bookings without duplicates", async () => {
    assert.equal((await db.query("SELECT * FROM customer_service_addresses")).rows.length, 1);
    await db.exec(`SET ROLE authenticated; SET test.uid='${owner}';
      INSERT INTO appointments VALUES(3,'${owner}','200 Ocean Ave','Palm Beach','FL','33480'),(4,'${owner}','200 Ocean Ave','Palm Beach','FL','33480');`);
    assert.equal((await db.query("SELECT * FROM customer_service_addresses")).rows.length, 2);
    await db.exec("RESET ROLE");
  });
  it("allows owners to edit saved addresses without rewriting appointment snapshots", async () => {
    await db.exec(`SET ROLE authenticated; SET test.uid='${owner}'; UPDATE customer_service_addresses SET street='300 Ocean Ave' WHERE street='200 Ocean Ave';`);
    assert.equal((await db.query("SELECT * FROM customer_service_addresses WHERE street='300 Ocean Ave'")).rows.length, 1);
    assert.equal((await db.query("SELECT * FROM appointments WHERE address_street='200 Ocean Ave'")).rows.length, 2);
    await db.exec("RESET ROLE");
  });
  it("prevents another customer from reading, editing, or inserting someone else's addresses", async () => {
    await db.exec(`SET ROLE authenticated; SET test.uid='${other}';`);
    assert.equal((await db.query("SELECT * FROM customer_service_addresses")).rows.length, 0);
    await db.exec("UPDATE customer_service_addresses SET street='Stolen'");
    await assert.rejects(db.exec(`INSERT INTO customer_service_addresses(customer_id,street,city,state,zip) VALUES('${owner}','Other','City','FL','33480')`), /row-level security/);
    await db.exec("RESET ROLE");
    assert.equal((await db.query("SELECT * FROM customer_service_addresses WHERE street='Stolen'")).rows.length, 0);
  });
  it("does not roll back booking when remembering its address fails", async () => {
    await db.exec("REVOKE INSERT(street,city,state,zip,customer_id) ON customer_service_addresses FROM authenticated");
    await db.exec(`SET ROLE authenticated; SET test.uid='${owner}'; INSERT INTO appointments VALUES(5,'${owner}','400 Ocean Ave','Palm Beach','FL','33480'); RESET ROLE;`);
    assert.equal((await db.query("SELECT * FROM appointments WHERE id=5")).rows.length, 1);
  });
});
