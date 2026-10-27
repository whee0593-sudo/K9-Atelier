import type { PetProfile } from "@/lib/pets";
import { mapPetProfileToWriteInput } from "@/lib/pets/map";
import {
  PetValidationError,
  validateCreatePetInput,
} from "@/lib/pets/validation";
import type { BookableService } from "@/lib/services";
import type { SpaGoalId } from "@/lib/spa-goals";
import { bookingDurationMinutes } from "@/lib/booking-flow";

export type BookingDogService = {
  /** Keeps one booking intent stable when a draft receives its saved pet ID. */
  bookingKey?: string;
  pet: PetProfile;
  service: BookableService;
  addOnIds: string[];
  addOnOptions: Record<string, string>;
  spaGoals: SpaGoalId[];
};

export function bookingDogsIntent(dogs: BookingDogService[]) {
  return JSON.stringify(
    dogs.map((dog) => ({
      pet: dog.bookingKey ?? dog.pet.id,
      name: dog.pet.name,
      breed: dog.pet.breed,
      weightLbs: dog.pet.weightLbs,
      serviceId: dog.service.id,
      addOnIds: [...dog.addOnIds].sort(),
      addOnOptions: Object.fromEntries(
        Object.entries(dog.addOnOptions).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
      spaGoals: [...dog.spaGoals].sort(),
    })),
  );
}

export function bookingDogsDuration(dogs: BookingDogService[]) {
  return dogs.reduce(
    (total, dog) =>
      total +
      bookingDurationMinutes(
        dog.service.id,
        dog.pet.weightLbs ?? 0,
        dog.addOnIds,
      ),
    0,
  );
}

/** Validate the entire group before saving any dog or choosing a date. */
export function validateBookingDogs(
  pets: PetProfile[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const pet of pets) {
    try {
      validateCreatePetInput(mapPetProfileToWriteInput(pet));
    } catch (error) {
      errors[pet.id] =
        error instanceof PetValidationError
          ? error.message
          : "Please complete this dog's details.";
    }
  }
  return errors;
}
