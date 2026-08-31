import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  INTERNAL_DEFINER_FUNCTIONS,
  RPC_SECURITY_SPECS,
  STAFF_WRITE_FUNCTIONS,
  canArchivePet,
  canRunStaffWrite,
  clientCanReadOtherCustomerReferralBalance,
  clientMayExecute,
  evaluateStaffStatusRpc,
  staffStatusRpcSignature,
} from "./function-security";

function hardenMigrationSql() {
  const dir = path.join(process.cwd(), "supabase", "migrations");
  const file = readdirSync(dir).find((name) =>
    name.endsWith("_harden_function_security.sql"),
  );
  assert.ok(file, "harden_function_security migration is missing");
  return readFileSync(path.join(dir, file), "utf8");
}

describe("function security grants", () => {
  it("does not let anon execute internal SECURITY DEFINER functions", () => {
    for (const name of INTERNAL_DEFINER_FUNCTIONS) {
      assert.equal(clientMayExecute(name, "anon"), false);
    }
    for (const spec of RPC_SECURITY_SPECS) {
      assert.equal(clientMayExecute(spec.name, "anon"), false);
    }
  });

  it("does not let a regular customer run staff write RPCs", () => {
    for (const name of STAFF_WRITE_FUNCTIONS) {
      assert.equal(canRunStaffWrite({ isStaff: false }), false);
      assert.equal(clientMayExecute(name, "authenticated_customer"), true);
    }
  });

  it("lets staff run authorized staff write RPCs", () => {
    assert.equal(canRunStaffWrite({ isStaff: true }), true);
    for (const name of STAFF_WRITE_FUNCTIONS) {
      assert.equal(clientMayExecute(name, "authenticated_staff"), true);
    }
  });

  it("does not let a customer archive someone else's pet", () => {
    assert.equal(
      canArchivePet({
        actorCustomerId: "customer-a",
        petCustomerId: "customer-b",
      }),
      false,
    );
  });

  it("lets a customer archive their own active pet", () => {
    assert.equal(
      canArchivePet({
        actorCustomerId: "customer-a",
        petCustomerId: "customer-a",
      }),
      true,
    );
  });

  it("does not let clients read another customer's referral balance", () => {
    assert.equal(clientCanReadOtherCustomerReferralBalance(), false);
    assert.equal(clientMayExecute("referral_available_cents", "anon"), false);
    assert.equal(
      clientMayExecute("referral_available_cents", "authenticated_customer"),
      false,
    );
  });

  it("does not let is_staff_user or is_owner_user accept a target user id", () => {
    const signature = staffStatusRpcSignature();
    assert.equal(signature.acceptsTargetUserId, false);
    assert.deepEqual([...signature.isStaffUserArgs], []);
    assert.deepEqual([...signature.isOwnerUserArgs], []);
    assert.equal(
      evaluateStaffStatusRpc({
        currentUserIsStaff: false,
        requestedUserId: "someone-else",
      }).ok,
      false,
    );
    assert.deepEqual(
      evaluateStaffStatusRpc({ currentUserIsStaff: true }),
      { ok: true, isStaff: true },
    );
  });
});

describe("harden_function_security migration", () => {
  const sql = hardenMigrationSql();

  it("fixes referral_available_cents search_path and keeps it server-only", () => {
    assert.match(sql, /SET search_path = ''/);
    assert.match(sql, /FROM public\.referral_credit_ledger/);
    assert.match(
      sql,
      /REVOKE ALL ON FUNCTION public\.referral_available_cents\(uuid\) FROM anon/,
    );
    assert.match(
      sql,
      /REVOKE ALL ON FUNCTION public\.referral_available_cents\(uuid\) FROM authenticated/,
    );
  });

  it("revokes client execute on rls_auto_enable when the helper exists", () => {
    assert.match(sql, /p\.proname = 'rls_auto_enable'/);
    assert.match(sql, /REVOKE ALL ON FUNCTION %s FROM anon/);
    assert.match(sql, /REVOKE ALL ON FUNCTION %s FROM authenticated/);
  });

  it("keeps authenticated execute only on the RPCs the website session must call", () => {
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.archive_own_pet\(uuid\) TO authenticated/);
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.is_staff_user\(\) TO authenticated/);
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.is_owner_user\(\) TO authenticated/);
    assert.match(
      sql,
      /GRANT EXECUTE ON FUNCTION public\.staff_set_appointment_status/,
    );
    assert.match(
      sql,
      /REVOKE ALL ON FUNCTION public\.archive_own_pet\(uuid\) FROM anon/,
    );
    assert.match(sql, /REVOKE ALL ON FUNCTION public\.is_staff_user\(\) FROM anon/);
  });
});
