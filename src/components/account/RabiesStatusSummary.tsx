import React from "react";
import type { PetProfile } from "@/lib/pets";
import {
  parsePetRabiesStatus,
  petProfileRabiesRecordLabel,
  petProfileVaccinationLabel,
  rabiesStatusDisplayLabel,
} from "@/lib/vaccinations/booking";

export function RabiesStatusSummary({
  pet,
  statusLabel = "Rabies Vaccination",
}: {
  pet: PetProfile;
  statusLabel?: string;
}) {
  const status = parsePetRabiesStatus(pet.rabiesStatus);
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-text-muted">{statusLabel}</dt>
        <dd className="mt-1 text-text">
          {status
            ? rabiesStatusDisplayLabel(status)
            : petProfileVaccinationLabel(pet)}
        </dd>
      </div>
      <div>
        <dt className="text-text-muted">Rabies Record</dt>
        <dd className="mt-1 text-text">{petProfileRabiesRecordLabel(pet)}</dd>
      </div>
    </dl>
  );
}
