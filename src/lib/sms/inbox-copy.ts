export function formatPetAndOwnerLabel(input: {
  firstName: string;
  petNames: string[];
}) {
  const pets = input.petNames.filter(Boolean);
  if (pets.length === 0) return input.firstName;
  return `${pets.join(" & ")} · ${input.firstName}`;
}

export function formatPetAndOwnerFullLabel(input: {
  ownerName: string;
  petNames: string[];
}) {
  const pets = input.petNames.filter(Boolean);
  const owner = input.ownerName.trim() || "Unknown";
  if (pets.length === 0) return owner;
  return `${pets.join(" & ")} ${owner}`;
}

export type StaffSmsInboxItem = {
  id: string;
  direction: "inbound" | "outbound";
  customerName: string;
  petNames: string;
  phone: string;
  body: string;
  createdAt: string;
};

export function inboundMediaUrls(params: Record<string, string>) {
  const count = Number(params.NumMedia ?? 0);
  if (!Number.isFinite(count) || count <= 0) return [];
  const urls: string[] = [];
  for (let i = 0; i < Math.min(count, 10); i += 1) {
    const url = params[`MediaUrl${i}`]?.trim();
    if (url) urls.push(url);
  }
  return urls;
}

export function inboundReplyTextForStaff(input: {
  body: string;
  mediaCount: number;
}) {
  const text = input.body.trim();
  const photos =
    input.mediaCount <= 0
      ? ""
      : input.mediaCount === 1
        ? "Photo"
        : `${input.mediaCount} photos`;
  if (text && photos) return `${text}\n\n[${photos} attached]`;
  return text || photos;
}

export function buildStaffInboundForwardSms(input: {
  ownerName: string;
  petNames: string[];
  body: string;
  phone: string;
  mediaCount?: number;
}) {
  const label = formatPetAndOwnerFullLabel({
    ownerName: input.ownerName,
    petNames: input.petNames,
  });
  const text = inboundReplyTextForStaff({
    body: input.body,
    mediaCount: input.mediaCount ?? 0,
  });
  return `K9 ATELIER reply from ${label} ${input.phone}:\n\n${text}`;
}
