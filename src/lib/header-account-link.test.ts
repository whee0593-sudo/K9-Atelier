import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  headerAccountDestination,
  resolveHeaderAccountDestination,
} from "@/lib/header-account-link";

const admin = { email: "admin@k9atelier.com" };
const customer = { email: "guest@example.com" };
const owner = { email: "Penny@k9atelier.com" };

describe("header account destination", () => {
  it("sends a logged-out visitor to the existing login page", () => {
    assert.deepEqual(headerAccountDestination({ user: null, isStaff: false }), {
      href: "/login",
      label: "Login",
    });
    assert.deepEqual(headerAccountDestination({ user: null, isStaff: true }), {
      href: "/login",
      label: "Login",
    });
  });

  it("sends an admin to the existing admin dashboard", () => {
    assert.deepEqual(headerAccountDestination({ user: admin, isStaff: true }), {
      href: "/admin",
      label: "My Account",
    });
  });

  it("sends a customer to the existing customer account", () => {
    assert.deepEqual(
      headerAccountDestination({ user: customer, isStaff: false }),
      { href: "/account", label: "My Account" },
    );
  });

  it("treats the owner as staff when the role check fails", () => {
    assert.deepEqual(headerAccountDestination({ user: owner, isStaff: null }), {
      href: "/admin",
      label: "My Account",
    });
    assert.deepEqual(headerAccountDestination({ user: owner, isStaff: false }), {
      href: "/admin",
      label: "My Account",
    });
  });

  it("keeps a customer on the customer account when the role check fails", () => {
    assert.deepEqual(
      headerAccountDestination({ user: customer, isStaff: null }),
      { href: "/account", label: "My Account" },
    );
  });
});

describe("resolveHeaderAccountDestination", () => {
  it("does not ask for a role when nobody is signed in", async () => {
    let roleChecks = 0;
    const destination = await resolveHeaderAccountDestination({
      getUser: async () => null,
      isStaffUser: async () => {
        roleChecks += 1;
        return true;
      },
    });

    assert.equal(roleChecks, 0);
    assert.deepEqual(destination, { href: "/login", label: "Login" });
  });

  it("uses the staff role from the signed-in session", async () => {
    const destination = await resolveHeaderAccountDestination({
      getUser: async () => admin,
      isStaffUser: async () => true,
    });

    assert.deepEqual(destination, { href: "/admin", label: "My Account" });
  });

  it("uses the customer account when the signed-in user is not staff", async () => {
    const destination = await resolveHeaderAccountDestination({
      getUser: async () => customer,
      isStaffUser: async () => false,
    });

    assert.deepEqual(destination, { href: "/account", label: "My Account" });
  });

  it("returns the same destination when the session is read again", async () => {
    const read = () =>
      resolveHeaderAccountDestination({
        getUser: async () => admin,
        isStaffUser: async () => true,
      });

    assert.deepEqual(await read(), await read());
  });

  it("still sends the owner to the admin dashboard if the role check throws", async () => {
    const destination = await resolveHeaderAccountDestination({
      getUser: async () => owner,
      isStaffUser: async () => {
        throw new Error("rpc unavailable");
      },
    });

    assert.deepEqual(destination, { href: "/admin", label: "My Account" });
  });

  it("sends a customer to their account if the role check throws", async () => {
    const destination = await resolveHeaderAccountDestination({
      getUser: async () => customer,
      isStaffUser: async () => {
        throw new Error("rpc unavailable");
      },
    });

    assert.deepEqual(destination, { href: "/account", label: "My Account" });
  });
});

describe("header account link wiring", () => {
  const linkSource = readFileSync(
    new URL("../components/auth/CustomerAuthLink.tsx", import.meta.url),
    "utf8",
  );
  const headerSource = readFileSync(
    new URL("../components/Header.tsx", import.meta.url),
    "utf8",
  );

  it("resolves the link from the authenticated user and staff role", () => {
    assert.match(linkSource, /resolveHeaderAccountDestination/);
    assert.match(linkSource, /auth\.getUser\(\)/);
    assert.match(linkSource, /rpc\("is_staff_user"\)/);
    assert.doesNotMatch(linkSource, /usePathname|localStorage|sessionStorage/);
    assert.doesNotMatch(linkSource, /setHref\("\/account"\)/);
  });

  it("uses one account control for the desktop and mobile header", () => {
    const uses = headerSource.match(/<CustomerAuthLink\b/g) ?? [];
    assert.equal(uses.length, 1);
    assert.doesNotMatch(headerSource, /href="\/account"|href="\/admin"/);
  });
});
