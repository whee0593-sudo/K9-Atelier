const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const address = { street: "100 Palm Ave", city: "Palm Beach", state: "FL", zip: "33480" };
function service(session, fail = false) {
  const rows = [{ id: "address-1", customer_id: "customer-1", ...address }, { id: "other-address", customer_id: "other-customer", ...address }];
  const calls = [];
  const admin = { from(table) {
    calls.push(table);
    const filters = [];
    let deleting = false;
    const query = {
      delete() { deleting = true; return query; },
      eq(key, value) { filters.push([key, value]); return query; },
      select() { return query; }, order() { return query; },
      maybeSingle: async () => ({ data: { id: "customer-1" }, error: null }),
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          if (fail) return { data: null, error: { message: "Database unavailable" } };
          const matches = rows.filter(row => filters.every(([key, value]) => row[key] === value));
          if (deleting) for (const row of matches) rows.splice(rows.indexOf(row), 1);
          return { data: matches, error: null };
        }).then(resolve, reject);
      },
    };
    return query;
  } };
  const exports = {};
  const code = ts.transpileModule(readFileSync(__dirname + "/staff-addresses.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, console: { error() {} }, require(name) {
    if (name === "@/lib/staff/auth") return { getStaffSession: async () => session };
    if (name === "@/lib/supabase/admin") return { createAdminClient: () => admin };
    return {};
  } });
  return { api: exports, rows, calls };
}
test("deletes only the selected customer's address and does not resurrect it on reload", async () => {
  const { api, rows, calls } = service({ user: { id: "staff" } });
  assert.equal((await api.deleteStaffCustomerServiceAddress("customer-1", address)).ok, true);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].customer_id, "other-customer");
  assert.equal((await api.listStaffCustomerServiceAddresses("customer-1")).addresses.length, 0);
  assert.ok(!calls.includes("appointments"));
  assert.equal((await api.deleteStaffCustomerServiceAddress("customer-1", address)).error, "not_found");
});
for (const error of ["unauthenticated", "forbidden"]) test(error + " cannot delete an address", async () => {
  const { api, rows, calls } = service({ error });
  assert.equal((await api.deleteStaffCustomerServiceAddress("customer-1", address)).error, error);
  assert.equal(rows.length, 2);
  assert.equal(calls.length, 0);
});
test("database failure leaves addresses intact", async () => {
  const { api, rows } = service({ user: { id: "staff" } }, true);
  assert.equal((await api.deleteStaffCustomerServiceAddress("customer-1", address)).error, "server");
  assert.equal(rows.length, 2);
});
