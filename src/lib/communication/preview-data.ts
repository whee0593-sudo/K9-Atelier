import {
  formatActivityAge,
  formatDisplayPhone,
  formatEtTime,
  formatMissedCallWhen,
  type InboxRow,
} from "@/lib/communication/present";
import type { CommunicationDetail } from "@/lib/communication/types";

function minutesAgo(now: number, minutes: number) {
  return new Date(now - minutes * 60_000).toISOString();
}

export function previewInboxRows(now = Date.now()): InboxRow[] {
  const tiaAt = minutesAgo(now, 2);
  const missedAt = minutesAgo(now, 12);
  const sarahAt = minutesAgo(now, 60);
  const yorkieAt = minutesAgo(now, 120);
  return [
    {
      id: "tia",
      phoneDisplay: formatDisplayPhone("+15615550101"),
      title: "Tia",
      petNames: "Milo",
      preview: "“Thank you! See you Tuesday.”",
      timeLabel: formatActivityAge(tiaAt, now),
      activityAt: tiaAt,
      unread: false,
      missed: false,
      unknown: false,
      hasMessage: true,
      hasCall: true,
      customerId: "preview-tia",
    },
    {
      id: "missed",
      phoneDisplay: formatDisplayPhone("+15615550199"),
      title: "Unknown Caller",
      petNames: "",
      preview: "Missed Call",
      timeLabel: formatActivityAge(missedAt, now),
      activityAt: missedAt,
      unread: false,
      missed: true,
      unknown: true,
      hasMessage: false,
      hasCall: true,
      customerId: null,
    },
    {
      id: "sarah",
      phoneDisplay: formatDisplayPhone("+15615550124"),
      title: "Sarah",
      petNames: "Teddy",
      preview: "“Can we move our appointment?”",
      timeLabel: formatActivityAge(sarahAt, now),
      activityAt: sarahAt,
      unread: true,
      missed: false,
      unknown: false,
      hasMessage: true,
      hasCall: false,
      customerId: "preview-sarah",
    },
    {
      id: "yorkie",
      phoneDisplay: formatDisplayPhone("+15615550188"),
      title: "Unknown Caller",
      petNames: "",
      preview: "“Hi, I have a 12 lb Maltese…”",
      timeLabel: formatActivityAge(yorkieAt, now),
      activityAt: yorkieAt,
      unread: true,
      missed: false,
      unknown: true,
      hasMessage: true,
      hasCall: false,
      customerId: null,
    },
  ];
}

export function previewDetail(who: string, now = Date.now()): CommunicationDetail {
  if (who === "sarah") {
    const at = minutesAgo(now, 60);
    return {
      id: "sarah",
      phoneE164: "+15615550124",
      phoneDisplay: "(561) 555-0124",
      title: "Sarah",
      petNames: "Teddy",
      customerId: "preview-sarah",
      unknown: false,
      banner: null,
      timeline: [
        {
          kind: "message",
          id: "sarah-1",
          at,
          direction: "inbound",
          body: "Can we move our appointment?",
          timeLabel: formatEtTime(new Date(at)),
          status: "received",
        },
      ],
    };
  }
  if (who === "yorkie") {
    const at = minutesAgo(now, 120);
    return {
      id: "yorkie",
      phoneE164: "+15615550188",
      phoneDisplay: "(561) 555-0188",
      title: "Unknown Caller",
      petNames: "",
      customerId: null,
      unknown: true,
      banner: null,
      timeline: [
        {
          kind: "message",
          id: "yorkie-1",
          at,
          direction: "inbound",
          body: "Hi, do you have availability for my Yorkie?",
          timeLabel: formatEtTime(new Date(at)),
          status: "received",
        },
      ],
    };
  }
  if (who === "missed") {
    const at = minutesAgo(now, 12);
    return {
      id: "missed",
      phoneE164: "+15615550199",
      phoneDisplay: "(561) 555-0199",
      title: "Unknown Caller",
      petNames: "",
      customerId: null,
      unknown: true,
      banner: null,
      timeline: [
        {
          kind: "call",
          id: "missed-call",
          at,
          direction: "inbound",
          label: "Missed Call",
          whenLabel: formatMissedCallWhen(at, new Date(now)),
          durationLabel: null,
          missed: true,
          status: "no-answer",
        },
      ],
    };
  }
  const earlier = minutesAgo(now, 180);
  const recent = minutesAgo(now, 2);
  return {
    id: "tia",
    phoneE164: "+15615550101",
    phoneDisplay: "(561) 555-0101",
    title: "Tia",
    petNames: "Milo",
    customerId: "preview-tia",
    unknown: false,
    banner: null,
    timeline: [
      {
        kind: "message",
        id: "tia-1",
        at: earlier,
        direction: "outbound",
        body: "K9 ATELIER: Milo is booked for Tuesday. Reply STOP to opt out.",
        timeLabel: formatEtTime(new Date(earlier)),
        status: "delivered",
      },
      {
        kind: "message",
        id: "tia-2",
        at: recent,
        direction: "inbound",
        body: "Thank you! See you Tuesday.",
        timeLabel: formatEtTime(new Date(recent)),
        status: "received",
      },
    ],
  };
}
