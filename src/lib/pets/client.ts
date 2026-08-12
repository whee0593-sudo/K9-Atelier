import { mapPetRecordToUiProfile } from "@/lib/pets/map";
import type { PetRecord, PetWriteInput } from "@/lib/pets/types";
import type { PetProfile } from "@/lib/pets";

export class PetClientError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PetClientError";
    this.status = status;
  }
}

async function readPetResponse<T>(response: Response): Promise<T> {
  let body: { error?: string; pets?: PetRecord[]; pet?: PetRecord; ok?: boolean };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    body = {};
  }

  if (!response.ok) {
    throw new PetClientError(
      body.error ?? "Something went wrong. Please try again.",
      response.status,
    );
  }

  return body as T;
}

export async function fetchCustomerPets(): Promise<PetProfile[]> {
  const response = await fetch("/api/pets", { credentials: "include" });
  const body = await readPetResponse<{ pets: PetRecord[] }>(response);
  return body.pets.map(mapPetRecordToUiProfile);
}

export async function createCustomerPet(
  input: PetWriteInput,
): Promise<PetProfile> {
  const response = await fetch("/api/pets", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await readPetResponse<{ pet: PetRecord }>(response);
  return mapPetRecordToUiProfile(body.pet);
}

export async function updateCustomerPet(
  petId: string,
  input: Partial<PetWriteInput>,
): Promise<PetProfile> {
  const response = await fetch(`/api/pets/${petId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await readPetResponse<{ pet: PetRecord }>(response);
  return mapPetRecordToUiProfile(body.pet);
}

export async function archiveCustomerPet(petId: string): Promise<void> {
  const response = await fetch(`/api/pets/${petId}`, {
    method: "DELETE",
    credentials: "include",
  });
  await readPetResponse<{ ok: boolean }>(response);
}
