import type { StaffSmsInboxItem } from "@/lib/sms/inbox-copy";
import {
  buildStudioIntroSms,
  buildStudioKnownCallerSms,
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
    mediaUrls: [],
    createdAt: "2026-08-22T14:10:00.000Z",
  },
  {
    id: "preview-in-1",
    direction: "inbound",
    customerName: "Alex Rivera",
    petNames: "Maple, Otto",
    phone: "+15615550123",
    body: "Thank you! I’ll meet you at the door.",
    mediaUrls: [],
    createdAt: "2026-08-22T14:12:00.000Z",
  },
  {
    id: "preview-in-photo",
    direction: "inbound",
    customerName: "Maya Patel",
    petNames: "Bella",
    phone: "+15615550188",
    body: "Photo",
    mediaUrls: ["/logo.png"],
    createdAt: "2026-08-22T14:20:00.000Z",
  },
];

const previewUnknownCallers: StudioUnknownCaller[] = [
  {
    phone: "+15615550444",
    calledAt: "2026-08-22T13:40:00.000Z",
    introSentAt: null,
  },
  {
    phone: "+15615550188",
    calledAt: "2026-08-22T13:20:00.000Z",
    introSentAt: "2026-08-22T13:20:05.000Z",
    label: "Bella · Maya",
  },
  {
    phone: "+15615550611",
    calledAt: "2026-08-21T18:10:00.000Z",
    introSentAt: null,
  },
  {
    phone: "+15615550622",
    calledAt: "2026-08-21T15:02:00.000Z",
    introSentAt: "2026-08-21T15:03:00.000Z",
  },
  {
    phone: "+15615550633",
    calledAt: "2026-08-20T11:40:00.000Z",
    introSentAt: null,
  },
  {
    phone: "+15615550644",
    calledAt: "2026-08-19T16:18:00.000Z",
    introSentAt: null,
  },
  {
    phone: "+15615550655",
    calledAt: "2026-08-18T09:05:00.000Z",
    introSentAt: null,
  },
  {
    phone: "+15615550666",
    calledAt: "2026-08-17T14:44:00.000Z",
    introSentAt: null,
  },
  {
    phone: "+15615550677",
    calledAt: "2026-08-16T10:30:00.000Z",
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
    knownCallerPreview: buildStudioKnownCallerSms({
      firstName: "Jane",
      petNames: ["Bella"],
    }),
  };
}
