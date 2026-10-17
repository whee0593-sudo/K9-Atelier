import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = join(import.meta.dirname, "../../..");

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) return [];
    return entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") ? [path] : [];
  });
}

describe("notification call sites", () => {
  it("does not keep a second claim rule or the old self-booking staff send", () => {
    const files = walk(join(root, "src"));
    const combined = files.map((file) => readFileSync(file, "utf8")).join("\n");
    assert.equal(combined.includes("function decideExisting"), false);
    assert.equal(combined.includes("decideExistingVisitClaim"), false);
    assert.equal(combined.includes("notifyStaffNewAppointment"), true);
    const created = source("src/lib/email/appointment-mails.ts");
    const createdFn = created.slice(created.indexOf("export async function sendAppointmentCreatedEmails"));
    assert.equal(createdFn.includes("notifyStaffNewAppointment"), false);
    assert.equal(source("src/lib/appointments/service.ts").includes("sendAppointmentEnRouteSms"), false);
    const support = source("src/app/api/support/route.ts");
    assert.equal(support.includes("https://api.resend.com/emails"), true);
    assert.equal(support.includes("deliverTrackedNotice"), false);
    assert.equal(support.includes("decideClaim"), false);
    assert.equal(combined.includes("from(\"visit_notifications\")"), false);
  });

  it("does not replace the production claim function in migrations", () => {
    const migrations = readdirSync(join(root, "supabase/migrations")).filter((name) =>
      name.includes("communication") || name.includes("visit_notification"),
    );
    assert.deepEqual(migrations.sort(), [
      "20261009120000_visit_notifications.sql",
      "20261009130000_communication_logs.sql",
      "20261009140000_visit_notification_attempts.sql",
      "20261016020000_merchant_communication_compatibility.sql",
    ]);
    const sql = migrations
      .map((name) => source(`supabase/migrations/${name}`))
      .join("\n");
    assert.equal(sql.includes("communication_logs_claim"), true);
    assert.equal(/create\s+or\s+replace\s+function\s+[^;]*communication_logs_claim/i.test(sql), false);
    assert.equal(sql.includes("CREATE TABLE public.visit_notifications"), false);
    assert.equal(sql.includes("CREATE TABLE IF NOT EXISTS public.visit_notifications"), true);
  });
});
