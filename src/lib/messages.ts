export type MessageAttachment = {
  id: string;
  fileName: string;
  fileType: string;
  url?: string;
};

export type CustomerMessage = {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  body: string;
  attachments: MessageAttachment[];
  sentAt: string;
  sentBy: string;
  read: boolean;
};

export type CustomerSummary = {
  id: string;
  name: string;
  email: string;
};

/** Demo customers for preview */
export const demoCustomers: CustomerSummary[] = [
  { id: "cust-1", name: "Jane Miller", email: "jane@example.com" },
  { id: "cust-2", name: "Robert Chen", email: "robert@example.com" },
];

/** Demo inbox — shared preview data */
export const demoMessages: CustomerMessage[] = [
  {
    id: "msg-1",
    customerId: "cust-1",
    customerName: "Jane Miller",
    customerEmail: "jane@example.com",
    subject: "Bella's next appointment reminder",
    body: "Hi Jane, this is a reminder that Bella's grooming is scheduled for next Tuesday. Please ensure her vaccination record is up to date.",
    attachments: [],
    sentAt: "2026-07-28T14:00:00",
    sentBy: "Penny",
    read: false,
  },
];

export function messagesForCustomer(customerId: string) {
  return demoMessages.filter((m) => m.customerId === customerId);
}

export function unreadCountForCustomer(customerId: string) {
  return messagesForCustomer(customerId).filter((m) => !m.read).length;
}
