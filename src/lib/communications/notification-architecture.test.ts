import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) files.push(full);
  }
  return files;
}

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("notification architecture", () => {
  it("removes the old staff new-appointment mail and the second merchant claim", () => {
    const files = walk(path.join(process.cwd(), "src"));
    const offenders = files.filter((file) => {
      if (file.endsWith("notification-architecture.test.ts")) return false;
      const text = readFileSync(file, "utf8");
      return (
        text.includes("notifyStaffNewAppointment") ||
        text.includes("function decideExisting(")
      );
    });
    assert.deepEqual(offenders, []);
  });

  it("loads the full visit before a self-serve merchant notice", () => {
    const booking = source("src/lib/appointments/service.ts");
    assert.match(booking, /notifyMerchantVisitCreatedFromVisit\(appointment\.visitId/);
    assert.equal(booking.includes("notifyStaffNewAppointment"), false);
    const merchant = source("src/lib/communications/merchant-notices.ts");
    assert.match(
      merchant,
      /export async function notifyMerchantVisitCreatedFromVisit/,
    );
    assert.match(merchant, /loadVisitAppointments\(visitId\)/);
    assert.equal(merchant.includes("decideExisting"), false);
  });

  it("uses a visit scope for logistics SMS when the appointment has a visit", () => {
    const sms = source("src/lib/sms/appointment-sms.ts");
    assert.match(sms, /dedupe: appointment\.visitId \? "visit" : "appointment"/);
  });

  it("keeps Contact Us on its direct Resend path", () => {
    const support = source("src/app/api/support/route.ts");
    assert.match(support, /api\.resend\.com/);
    assert.equal(support.includes("dispatchCommunication"), false);
    assert.equal(support.includes("communication_logs"), false);
  });
});
