/** Customer-facing list: "Daisy", "Daisy and Milo", "Daisy, Milo and Coco". */
export function formatVisitPetNames(
  names: Array<string | null | undefined>,
  fallback = "your dog",
) {
  const cleaned: string[] = [];
  for (const name of names) {
    const trimmed = name?.trim();
    if (!trimmed || cleaned.includes(trimmed)) continue;
    cleaned.push(trimmed);
  }
  if (cleaned.length === 0) return fallback;
  if (cleaned.length === 1) return cleaned[0]!;
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(", ")} and ${cleaned[cleaned.length - 1]}`;
}
