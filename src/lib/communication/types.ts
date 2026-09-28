export type CommunicationDirection = "inbound" | "outbound";

export type CommunicationMessageItem = {
  kind: "message";
  id: string;
  at: string;
  direction: CommunicationDirection;
  body: string;
  timeLabel: string;
  status: string;
};

export type CommunicationCallItem = {
  kind: "call";
  id: string;
  at: string;
  direction: CommunicationDirection;
  label: string;
  whenLabel: string;
  durationLabel: string | null;
  missed: boolean;
  status: string;
};

export type CommunicationTimelineItem =
  | CommunicationMessageItem
  | CommunicationCallItem;

export type CommunicationDetail = {
  id: string;
  phoneE164: string;
  phoneDisplay: string;
  title: string;
  petNames: string;
  customerId: string | null;
  unknown: boolean;
  timeline: CommunicationTimelineItem[];
  banner: string | null;
};
