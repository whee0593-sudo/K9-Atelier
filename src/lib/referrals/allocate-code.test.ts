import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  REFERRAL_CLIENT_ERROR,
  REFERRAL_CODE_NORMALIZED_CONSTRAINT,
  REFERRAL_CODE_PET_CONSTRAINT,
  allocateUniqueReferralCode,
  ensurePetReferralCodeFromStore,
  isNormalizedReferralCodeCollision,
  isPetReferralCodeRowCollision,
  keepPrimaryIfReferralFails,
  referralClientErrorMessage,
  type ReferralCodeStore,
  type ReferralWriteError,
} from "./allocate-code";
import {
  buildReferralCodeBase,
  nextReferralCodeCandidate,
  normalizeReferralCode,
} from "./codes";

const PRODUCTION_COLLISION: ReferralWriteError = {
  code: "23505",
  message: `duplicate key value violates unique constraint "${REFERRAL_CODE_NORMALIZED_CONSTRAINT}"`,
  details: "Key (referral_code_normalized)=(MILO-JANE-S) already exists.",
};

type StoredCode = {
  petId: string;
  ownerCustomerId: string;
  referral_code: string;
  referral_code_normalized: string;
};

function collisionError(
  constraint: string,
  details: string,
  code: string | number | null = "23505",
): ReferralWriteError {
  return {
    code,
    message: `duplicate key value violates unique constraint "${constraint}"`,
    details,
  };
}

function createStore(input?: {
  owners?: Record<string, { first_name: string; last_name: string }>;
  race?: boolean;
}) {
  const rows: StoredCode[] = [];
  const owners = input?.owners ?? {};
  const inflight = new Map<string, Promise<void>>();
  let inserts = 0;

  const store: ReferralCodeStore = {
    async findByPetId(petId) {
      const row = rows.find((entry) => entry.petId === petId);
      return row ? { referral_code: row.referral_code } : null;
    },
    async findOwnerName(ownerCustomerId) {
      return owners[ownerCustomerId] ?? null;
    },
    async insert(row) {
      inserts += 1;
      const conflict = () => {
        const samePet = rows.find((entry) => entry.petId === row.pet_id);
        if (samePet) {
          return collisionError(
            REFERRAL_CODE_PET_CONSTRAINT,
            `Key (pet_id)=(${row.pet_id}) already exists.`,
          );
        }
        const sameCode = rows.find(
          (entry) =>
            entry.referral_code_normalized === row.referral_code_normalized,
        );
        if (sameCode) {
          return collisionError(
            REFERRAL_CODE_NORMALIZED_CONSTRAINT,
            `Key (referral_code_normalized)=(${row.referral_code_normalized}) already exists.`,
          );
        }
        return null;
      };

      const existing = conflict();
      if (existing) return { ok: false as const, error: existing };

      if (input?.race) {
        const prior = inflight.get(row.referral_code_normalized);
        if (prior) {
          await prior;
          const afterWait = conflict();
          if (afterWait) return { ok: false as const, error: afterWait };
        }
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        inflight.set(row.referral_code_normalized, gate);
        await Promise.resolve();
        const afterYield = conflict();
        if (afterYield) {
          release();
          inflight.delete(row.referral_code_normalized);
          return { ok: false as const, error: afterYield };
        }
        rows.push({
          petId: row.pet_id,
          ownerCustomerId: row.owner_customer_id,
          referral_code: row.referral_code,
          referral_code_normalized: row.referral_code_normalized,
        });
        release();
        inflight.delete(row.referral_code_normalized);
        return { ok: true as const };
      }

      rows.push({
        petId: row.pet_id,
        ownerCustomerId: row.owner_customer_id,
        referral_code: row.referral_code,
        referral_code_normalized: row.referral_code_normalized,
      });
      return { ok: true as const };
    },
  };

  return {
    store,
    rows,
    get inserts() {
      return inserts;
    },
  };
}

const jane = { first_name: "Jane", last_name: "Smith" };

describe("referral code collisions", () => {
  const errorLogs: unknown[][] = [];
  const originalError = console.error;

  afterEach(() => {
    console.error = originalError;
    errorLogs.length = 0;
  });

  function captureErrors() {
    console.error = (...args: unknown[]) => {
      errorLogs.push(args);
    };
  }

  it("recognizes only the normalized referral code constraint", () => {
    assert.equal(isNormalizedReferralCodeCollision(PRODUCTION_COLLISION), true);
    assert.equal(
      isNormalizedReferralCodeCollision({
        message: PRODUCTION_COLLISION.message,
      }),
      true,
    );
    assert.equal(
      isNormalizedReferralCodeCollision({
        code: "23505",
        details: "Key (referral_code_normalized)=(MILO) already exists.",
      }),
      true,
    );
    assert.equal(
      isNormalizedReferralCodeCollision(
        collisionError(
          REFERRAL_CODE_PET_CONSTRAINT,
          "Key (pet_id)=(pet-1) already exists.",
        ),
      ),
      false,
    );
    assert.equal(
      isPetReferralCodeRowCollision(
        collisionError(
          REFERRAL_CODE_PET_CONSTRAINT,
          "Key (pet_id)=(pet-1) already exists.",
        ),
      ),
      true,
    );
    assert.equal(
      isNormalizedReferralCodeCollision({
        code: "23503",
        message: PRODUCTION_COLLISION.message,
      }),
      false,
    );
  });

  it("collapses case and punctuation onto one normalized key", () => {
    const variants = ["MILO", "milo", "Milo", "MILO-", " MILO "];
    const normalized = variants.map((value) => normalizeReferralCode(value));
    assert.deepEqual(normalized, ["MILO", "MILO", "MILO", "MILO", "MILO"]);
    assert.equal(
      buildReferralCodeBase({
        petName: "milo",
        ownerFirstName: "jane",
        ownerLastName: "smith",
      }),
      buildReferralCodeBase({
        petName: "MILO",
        ownerFirstName: "Jane",
        ownerLastName: "Smith",
      }),
    );
  });

  it("creates a code for a new pet", async () => {
    const db = createStore({ owners: { cust: jane } });
    const code = await ensurePetReferralCodeFromStore(db.store, {
      petId: "pet-1",
      petName: "Milo",
      ownerCustomerId: "cust",
    });
    assert.equal(code, "MILO-JANE-S");
    assert.equal(db.rows[0]?.referral_code_normalized, "MILO-JANE-S");
    assert.equal(db.inserts, 1);
  });

  it("suffixes the code when two pets share a name", async () => {
    const db = createStore({ owners: { cust: jane } });
    const first = await ensurePetReferralCodeFromStore(db.store, {
      petId: "pet-1",
      petName: "Milo",
      ownerCustomerId: "cust",
    });
    const second = await ensurePetReferralCodeFromStore(db.store, {
      petId: "pet-2",
      petName: "Milo",
      ownerCustomerId: "cust",
    });
    assert.equal(first, "MILO-JANE-S");
    assert.equal(second, "MILO-JANE-S-2");
    assert.equal(new Set(db.rows.map((row) => row.referral_code_normalized)).size, 2);
  });

  it("gives each customer's Milo a unique code when the base collides", async () => {
    const db = createStore({
      owners: {
        jane: jane,
        otherJane: { first_name: "Jane", last_name: "Stone" },
        alex: { first_name: "Alex", last_name: "Park" },
      },
    });
    const codes = await Promise.all([
      ensurePetReferralCodeFromStore(db.store, {
        petId: "pet-jane",
        petName: "Milo",
        ownerCustomerId: "jane",
      }),
      ensurePetReferralCodeFromStore(db.store, {
        petId: "pet-stone",
        petName: "milo",
        ownerCustomerId: "otherJane",
      }),
      ensurePetReferralCodeFromStore(db.store, {
        petId: "pet-alex",
        petName: "Milo",
        ownerCustomerId: "alex",
      }),
    ]);
    assert.deepEqual(codes.sort(), [
      "MILO-ALEX-P",
      "MILO-JANE-S",
      "MILO-JANE-S-2",
    ]);
  });

  it("retries when the stored code differs only by case", async () => {
    const db = createStore({ owners: { cust: jane } });
    db.rows.push({
      petId: "existing",
      ownerCustomerId: "someone",
      referral_code: "milo-jane-s",
      referral_code_normalized: normalizeReferralCode("milo-jane-s"),
    });
    const code = await ensurePetReferralCodeFromStore(db.store, {
      petId: "pet-new",
      petName: "Milo",
      ownerCustomerId: "cust",
    });
    assert.equal(code, "MILO-JANE-S-2");
    assert.equal(
      db.rows.filter((row) => row.referral_code_normalized === "MILO-JANE-S").length,
      1,
    );
  });

  it("retries a forced normalized-code collision without returning the database error", async () => {
    captureErrors();
    let attempts = 0;
    const result = await allocateUniqueReferralCode({
      base: "MILO-JANE-S",
      insertCandidate: async ({ normalized }) => {
        attempts += 1;
        if (normalized === "MILO-JANE-S") {
          return { ok: false, error: PRODUCTION_COLLISION };
        }
        return { ok: true };
      },
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.code, "MILO-JANE-S-2");
    assert.equal(attempts, 2);
    assert.equal(errorLogs.length, 0);
  });

  it("allocates distinct codes when two creates race on the same candidate", async () => {
    const db = createStore({ owners: { a: jane, b: jane }, race: true });
    const [first, second] = await Promise.all([
      ensurePetReferralCodeFromStore(db.store, {
        petId: "pet-a",
        petName: "Milo",
        ownerCustomerId: "a",
      }),
      ensurePetReferralCodeFromStore(db.store, {
        petId: "pet-b",
        petName: "Milo",
        ownerCustomerId: "b",
      }),
    ]);
    assert.deepEqual([first, second].sort(), ["MILO-JANE-S", "MILO-JANE-S-2"]);
    assert.equal(new Set(db.rows.map((row) => row.referral_code_normalized)).size, 2);
  });

  it("keeps the pet and the booking when referral allocation collides or fails", async () => {
    captureErrors();
    const db = createStore({ owners: { cust: jane } });
    const pets: Array<{ id: string }> = [];
    const appointments: Array<{ petId: string }> = [];

    async function createPetAndBooking(petId: string, failReferral: boolean) {
      const pet = { id: petId };
      pets.push(pet);
      const saved = await keepPrimaryIfReferralFails(pet, async () => {
        if (failReferral) {
          throw new Error(PRODUCTION_COLLISION.message ?? "database error");
        }
        return ensurePetReferralCodeFromStore(db.store, {
          petId,
          petName: "Milo",
          ownerCustomerId: "cust",
        });
      });
      appointments.push({ petId: saved.id });
      return saved;
    }

    const first = await createPetAndBooking("pet-1", false);
    const second = await createPetAndBooking("pet-2", false);
    const third = await createPetAndBooking("pet-3", true);

    assert.equal(first.id, "pet-1");
    assert.equal(second.id, "pet-2");
    assert.equal(third.id, "pet-3");
    assert.deepEqual(
      appointments.map((row) => row.petId),
      ["pet-1", "pet-2", "pet-3"],
    );
    assert.equal(pets.length, 3);
    assert.equal(
      db.rows.find((row) => row.petId === "pet-2")?.referral_code,
      "MILO-JANE-S-2",
    );
    assert.equal(
      db.rows.some((row) => row.petId === "pet-3"),
      false,
    );
    assert.equal(
      errorLogs.some((entry) =>
        JSON.stringify(entry).includes(REFERRAL_CODE_NORMALIZED_CONSTRAINT),
      ),
      true,
    );
  });

  it("does not retry unrelated database errors and still returns no client error", async () => {
    captureErrors();
    let attempts = 0;
    const allocated = await allocateUniqueReferralCode({
      base: "MILO-JANE-S",
      insertCandidate: async () => {
        attempts += 1;
        return {
          ok: false,
          error: {
            code: "23503",
            message: 'insert or update on table "pet_referral_codes" violates foreign key constraint',
          },
        };
      },
    });
    assert.equal(attempts, 1);
    assert.equal(allocated.ok, false);
    if (!allocated.ok) assert.equal(allocated.reason, "database");

    const pet = { id: "pet-1" };
    const saved = await keepPrimaryIfReferralFails(pet, async () => {
      throw new Error(
        'duplicate key value violates unique constraint "pet_referral_codes_referral_code_normalized_key"',
      );
    });
    assert.equal(saved, pet);
    assert.equal(
      referralClientErrorMessage(
        new Error(PRODUCTION_COLLISION.message ?? ""),
      ),
      REFERRAL_CLIENT_ERROR,
    );
    assert.doesNotMatch(REFERRAL_CLIENT_ERROR, /duplicate key|unique constraint/i);
  });

  it("logs and stops after the retry limit without throwing or dropping the pet", async () => {
    captureErrors();
    const db = createStore({ owners: { cust: jane } });
    for (let attempt = 1; attempt <= 40; attempt += 1) {
      const code = nextReferralCodeCandidate("MILO-JANE-S", attempt);
      db.rows.push({
        petId: `taken-${attempt}`,
        ownerCustomerId: "other",
        referral_code: code,
        referral_code_normalized: code,
      });
    }
    const pets = [{ id: "new-pet" }];
    const appointments: string[] = [];
    let thrown = false;
    let code: string | null = "unset";
    try {
      const saved = await keepPrimaryIfReferralFails(pets[0], async () => {
        code = await ensurePetReferralCodeFromStore(db.store, {
          petId: "new-pet",
          petName: "Milo",
          ownerCustomerId: "cust",
        });
      });
      appointments.push(saved.id);
    } catch {
      thrown = true;
    }
    assert.equal(thrown, false);
    assert.equal(code, null);
    assert.deepEqual(appointments, ["new-pet"]);
    assert.equal(pets[0]?.id, "new-pet");
    assert.equal(
      errorLogs.some((entry) => JSON.stringify(entry).includes("exhausted")),
      true,
    );
    assert.equal(
      referralClientErrorMessage(new Error(PRODUCTION_COLLISION.message ?? "")),
      REFERRAL_CLIENT_ERROR,
    );
  });

  it("reuses the existing pet code when the pet row unique constraint loses a race", async () => {
    const db = createStore({ owners: { cust: jane } });
    db.rows.push({
      petId: "pet-1",
      ownerCustomerId: "cust",
      referral_code: "MILO-JANE-S",
      referral_code_normalized: "MILO-JANE-S",
    });
    const code = await ensurePetReferralCodeFromStore(db.store, {
      petId: "pet-1",
      petName: "Milo",
      ownerCustomerId: "cust",
    });
    assert.equal(code, "MILO-JANE-S");
    assert.equal(db.inserts, 0);

    let attempts = 0;
    const raced = await allocateUniqueReferralCode({
      base: "MILO-JANE-S",
      insertCandidate: async () => {
        attempts += 1;
        return {
          ok: false,
          error: collisionError(
            REFERRAL_CODE_PET_CONSTRAINT,
            "Key (pet_id)=(pet-1) already exists.",
          ),
        };
      },
    });
    assert.equal(attempts, 1);
    assert.equal(raced.ok, false);
    if (!raced.ok) assert.equal(raced.reason, "pet_row_exists");
  });

  it("keeps the normalized unique constraint in the database migration", () => {
    const sql = readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/20260830020000_referral_rewards.sql",
      ),
      "utf8",
    );
    assert.match(sql, /referral_code_normalized text NOT NULL/);
    assert.match(sql, /UNIQUE \(referral_code_normalized\)/);
    assert.doesNotMatch(
      sql,
      /DROP CONSTRAINT[^;]*referral_code_normalized/i,
    );
  });

  it("returns the same code when two requests race to create one pet", async () => {
    const db = createStore({ owners: { cust: jane }, race: true });
    const [first, second] = await Promise.all([
      ensurePetReferralCodeFromStore(db.store, {
        petId: "pet-1",
        petName: "Milo",
        ownerCustomerId: "cust",
      }),
      ensurePetReferralCodeFromStore(db.store, {
        petId: "pet-1",
        petName: "Milo",
        ownerCustomerId: "cust",
      }),
    ]);
    assert.equal(first, "MILO-JANE-S");
    assert.equal(second, "MILO-JANE-S");
    assert.equal(db.rows.length, 1);
  });

  it("keeps referral assignment after the pet insert and outside appointment insert", () => {
    const petService = readFileSync(
      path.join(process.cwd(), "src/lib/pets/service.ts"),
      "utf8",
    );
    const booking = readFileSync(
      path.join(process.cwd(), "src/lib/staff/create-customer-booking.ts"),
      "utf8",
    );
    const appointment = readFileSync(
      path.join(process.cwd(), "src/lib/appointments/service.ts"),
      "utf8",
    );
    const createPetSource = petService.slice(
      petService.indexOf("export async function createPet"),
    );
    const petInsert = createPetSource.indexOf('.from("pets")');
    const petReferral = createPetSource.indexOf("ensurePetReferralCode");
    const petReturn = createPetSource.indexOf("return { pet }");
    assert.ok(petInsert >= 0 && petReferral > petInsert && petReturn > petReferral);
    assert.match(createPetSource, /keepPrimaryIfReferralFails/);
    assert.match(booking, /keepPrimaryIfReferralFails/);
    const referralAt = booking.indexOf("ensurePetReferralCode");
    const appointmentInsert = booking.indexOf('.from("appointments")');
    assert.ok(referralAt >= 0 && appointmentInsert > referralAt);
    assert.doesNotMatch(appointment, /pet_referral_codes/);
  });
});
