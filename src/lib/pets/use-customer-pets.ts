"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  archiveCustomerPet,
  createCustomerPet,
  fetchCustomerPets,
  PetClientError,
  updateCustomerPet,
} from "@/lib/pets/client";
import { mapPetProfileToWriteInput } from "@/lib/pets/map";
import { validatePetId } from "@/lib/pets/validation";
import { normalizePetProfile, type PetProfile } from "@/lib/pets";

const SAVE_DEBOUNCE_MS = 600;

function isPersistedPetId(id: string): boolean {
  try {
    validatePetId(id);
    return true;
  } catch {
    return false;
  }
}

export function useCustomerPets() {
  const [pets, setPets] = useState<PetProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(() => new Set());
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchCustomerPets();
      setPets(next.map(normalizePetProfile));
    } catch (err) {
      setError(
        err instanceof PetClientError
          ? err.message
          : "Could not load your pet profiles.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    return () => {
      for (const timer of saveTimers.current.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  const markSaving = useCallback((id: string, saving: boolean) => {
    setSavingIds((current) => {
      const next = new Set(current);
      if (saving) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const persistPetUpdate = useCallback(
    async (pet: PetProfile) => {
      if (!isPersistedPetId(pet.id)) return;

      markSaving(pet.id, true);
      setError(null);
      try {
        const updated = await updateCustomerPet(
          pet.id,
          mapPetProfileToWriteInput(pet),
        );
        setPets((current) =>
          current.map((item) => (item.id === pet.id ? updated : item)),
        );
      } catch (err) {
        setError(
          err instanceof PetClientError
            ? err.message
            : "Could not save this pet profile.",
        );
      } finally {
        markSaving(pet.id, false);
      }
    },
    [markSaving],
  );

  const scheduleSave = useCallback(
    (pet: PetProfile) => {
      if (!isPersistedPetId(pet.id)) return;

      const existing = saveTimers.current.get(pet.id);
      if (existing) clearTimeout(existing);

      saveTimers.current.set(
        pet.id,
        setTimeout(() => {
          saveTimers.current.delete(pet.id);
          void persistPetUpdate(pet);
        }, SAVE_DEBOUNCE_MS),
      );
    },
    [persistPetUpdate],
  );

  const updatePetLocal = useCallback(
    (id: string, updates: Partial<PetProfile>) => {
      setPets((current) => {
        const next = current.map((pet) =>
          pet.id === id ? normalizePetProfile({ ...pet, ...updates }) : pet,
        );
        const updated = next.find((pet) => pet.id === id);
        if (updated && isPersistedPetId(id)) {
          scheduleSave(updated);
        }
        return next;
      });
    },
    [scheduleSave],
  );

  const createPet = useCallback(async (draft: PetProfile) => {
    setError(null);
    markSaving(draft.id, true);
    try {
      const created = await createCustomerPet(mapPetProfileToWriteInput(draft));
      setPets((current) => [...current, created]);
      return created;
    } catch (err) {
      const message =
        err instanceof PetClientError
          ? err.message
          : "Could not save this pet profile.";
      setError(message);
      throw err;
    } finally {
      markSaving(draft.id, false);
    }
  }, [markSaving]);

  const archivePet = useCallback(async (id: string) => {
    if (!isPersistedPetId(id)) {
      setPets((current) => current.filter((pet) => pet.id !== id));
      return;
    }

    setError(null);
    markSaving(id, true);
    try {
      await archiveCustomerPet(id);
      setPets((current) => current.filter((pet) => pet.id !== id));
    } catch (err) {
      setError(
        err instanceof PetClientError
          ? err.message
          : "Could not remove this pet profile.",
      );
      throw err;
    } finally {
      markSaving(id, false);
    }
  }, [markSaving]);

  return {
    pets,
    loading,
    error,
    savingIds,
    reload,
    updatePetLocal,
    createPet,
    archivePet,
    isPersistedPetId,
  };
}
