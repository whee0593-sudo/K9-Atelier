import { AdminMessageComposer } from "@/components/admin/AdminMessageComposer";

export default function AdminMessagesPage() {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-gold-dark">
        Customer Messages
      </h2>
      <p className="mt-2 text-sm text-text-muted">
        Send a text from the studio number. Unknown callers appear here so you
        can send the booking and contact links. Replies are forwarded to your
        phone.
      </p>
      <div className="mt-8">
        <AdminMessageComposer />
      </div>
    </div>
  );
}
