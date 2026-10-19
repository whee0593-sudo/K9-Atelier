"use client";

import React from "react";
import {
  ALLERGY_CHOICES,
  ALLERGY_DETAILS_LABEL,
  ALLERGY_HEADING,
  ALLERGY_QUESTION,
  type AllergyStatus,
} from "@/lib/allergies";

type Props = {
  status: AllergyStatus | null | undefined;
  details: string | null | undefined;
  onStatusChange: (status: AllergyStatus) => void;
  onDetailsChange: (details: string) => void;
  name?: string;
  inputClassName?: string;
  labelClassName?: string;
};

export function AllergyFields({
  status,
  details,
  onStatusChange,
  onDetailsChange,
  name = "allergy-status",
  inputClassName = "mt-2 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm text-text",
  labelClassName = "font-body text-sm font-medium text-text",
}: Props) {
  return (
    <fieldset className="space-y-3">
      <legend className={labelClassName}>{ALLERGY_HEADING}</legend>
      <p className="font-body text-base leading-relaxed text-ink">{ALLERGY_QUESTION}</p>
      <div className="space-y-2">
        {ALLERGY_CHOICES.map((choice) => (
          <label key={choice.value} className="flex items-center gap-3 text-sm text-ink">
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={status === choice.value}
              onChange={() => onStatusChange(choice.value)}
            />
            <span>{choice.label}</span>
          </label>
        ))}
      </div>
      {status === "yes" ? (
        <label className="block">
          <span className={labelClassName}>{ALLERGY_DETAILS_LABEL}</span>
          <textarea
            value={details ?? ""}
            onChange={(event) => onDetailsChange(event.target.value)}
            rows={4}
            className={inputClassName}
          />
        </label>
      ) : null}
    </fieldset>
  );
}
