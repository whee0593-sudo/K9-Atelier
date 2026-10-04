import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

describe("staff pet update privileges", () => {
  it("updates staff pets with the admin client (not column-limited authenticated)", () => {
    const source = readFileSync(
      new URL("./staff-service.ts", import.meta.url),
      "utf8",
    );
    const fnStart = source.indexOf("export async function updateStaffPet");
    assert.ok(fnStart >= 0, "updateStaffPet missing");
    const nextExport = source.indexOf("\nexport async function", fnStart + 1);
    const body = source.slice(fnStart, nextExport === -1 ? undefined : nextExport);

    assert.match(body, /createAdminClient\(\)/);
    assert.match(body, /\.from\("pets"\)\s*\n\s*\.update\(updateRow\)/);
    assert.doesNotMatch(
      body,
      /const supabase = await createAuthenticatedSupabaseClient\(\);\s*\n\s*const updateRow/,
    );
  });

  it("grants authenticated INSERT/UPDATE on pets.rabies_status", () => {
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const file = readdirSync(dir).find((name) =>
      name.endsWith("_pets_rabies_status_grants.sql"),
    );
    assert.ok(file, "pets_rabies_status_grants migration is missing");
    const sql = readFileSync(path.join(dir, file), "utf8");
    assert.match(sql, /GRANT INSERT \(rabies_status\) ON TABLE public\.pets TO authenticated/);
    assert.match(sql, /GRANT UPDATE \(rabies_status\) ON TABLE public\.pets TO authenticated/);
    assert.match(sql, /GRANT USAGE ON TYPE public\.pet_rabies_status TO authenticated/);
  });
});
