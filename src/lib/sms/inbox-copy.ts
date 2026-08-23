export function formatPetAndOwnerLabel(input: {
  firstName: string;
  petNames: string[];
}) {
  const pets = input.petNames.filter(Boolean);
  if (pets.length === 0) return input.firstName;
  return `${pets.join(" & ")} · ${input.firstName}`;
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

export function buildStaffInboundForwardSms(input: {
  firstName: string;
  petNames: string[];
  body: string;
  phone: string;
}) {
  const label = formatPetAndOwnerLabel({
    firstName: input.firstName,
    petNames: input.petNames,
  });
  return `K9 ATELIER reply from ${label} ${input.phone}:\n\n${input.body.trim()}`;
}
