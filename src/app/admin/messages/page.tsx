import { AdminMessageComposer } from "@/components/admin/AdminMessageComposer";

export default function AdminMessagesPage() {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-gold-dark">
        Customer Messages
      </h2>
      <p className="mt-2 text-sm text-text-muted">
        Send a message or file to a customer. It appears in their account under
        Messages from K9 Atelier.
      </p>
      <div className="mt-8">
        <AdminMessageComposer />
      </div>
    </div>
  );
}
