import { AdminMessageComposer } from "@/components/admin/AdminMessageComposer";

export default function AdminMessagesPage() {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-gold-dark">
        Customer Messages
      </h2>
      <p className="mt-2 text-sm text-text-muted">
        Send a text from the studio number. Replies show on this page and are
        forwarded to your phone. Use Call customer to ring your cell, then
        connect the guest.
      </p>
      <div className="mt-8">
        <AdminMessageComposer />
      </div>
    </div>
  );
}
