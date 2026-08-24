import type { StaffSmsInboxItem } from "@/lib/sms/inbox-copy";
import {
  buildStudioIntroSms,
  staffRecipientSortKey,
  type StaffSmsRecipient,
  type StudioUnknownCaller,
} from "@/lib/sms/staff-compose-copy";

const previewRecipients: StaffSmsRecipient[] = [
  {
    id: "preview-alex",
    firstName: "Alex",
    lastName: "Rivera",
    name: "Alex Rivera",
    email: "alex@example.com",
    phone: "+15615550123",
    petNames: ["Maple", "Otto"],
    canText: true,
  },
  {
    id: "preview-maya",
    firstName: "Maya",
    lastName: "Patel",
    name: "Maya Patel",
    email: "maya@example.com",
    phone: "+15615550188",
    petNames: ["Bella"],
    canText: true,
  },
  {
    id: "preview-jordan",
    firstName: "Jordan",
    lastName: "Kim",
    name: "Jordan Kim",
    email: "jordan@example.com",
    phone: "",
    petNames: ["Scout"],
    canText: false,
  },
  {
    id: "preview-chris",
    firstName: "Chris",
    lastName: "Nguyen",
    name: "Chris Nguyen",
    email: "chris@example.com",
    phone: "+15615550900",
    petNames: ["Daisy"],
    canText: true,
  },
];

const previewInbox: StaffSmsInboxItem[] = [
  {
    id: "preview-out-1",
    direction: "outbound",
    customerName: "Alex Rivera",
    petNames: "Maple, Otto",
    phone: "+15615550123",
    body: "Maple and Otto are almost ready.",
    createdAt: "2026-08-22T14:10:00.000Z",
  },
  {
    id: "preview-in-1",
    direction: "inbound",
    customerName: "Alex Rivera",
    petNames: "Maple, Otto",
    phone: "+15615550123",
    body: "Thank you! I’ll meet you at the door.",
    createdAt: "2026-08-22T14:12:00.000Z",
  },
];

const previewUnknownCallers: StudioUnknownCaller[] = [
  {
    phone: "+15615550444",
    calledAt: "2026-08-22T13:40:00.000Z",
    introSentAt: null,
  },
];

export function buildPreviewStaffMessages() {
  return {
    recipients: [...previewRecipients].sort((a, b) =>
      staffRecipientSortKey(a).localeCompare(staffRecipientSortKey(b), "en"),
    ),
    inbox: previewInbox,
    unknownCallers: previewUnknownCallers,
    introPreview: buildStudioIntroSms(),
  };
}
