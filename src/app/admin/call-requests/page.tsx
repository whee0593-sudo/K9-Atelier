import { getStaffSession, isOwnerUser } from "@/lib/staff/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CallRequestActions } from "@/components/admin/CallRequestActions";
export const dynamic = "force-dynamic";

export default async function CallRequestsPage() {
  const session = await getStaffSession().catch(() => ({ error: "unauthenticated" as const }));
  if ("error" in session) return <p>Staff access required.</p>;
  const canLink = await isOwnerUser();
  const { data, error } = await createAdminClient().from("call_requests").select("id,name,phone,status,requested_at,card_brand,card_last4,linked_customer_id,notice_sent_at")
    .in("status", ["requested", "contacted"]).order("requested_at", { ascending: false }).limit(100);
  return <div className="space-y-6">
    <header><h1 className="font-display text-3xl text-ink">Call Requests</h1><p className="mt-3 text-base text-ink">These requests are not appointments. Call to complete the details and arrange a visit.</p></header>
    {error ? <p role="alert">The callback queue is unavailable. Check the database migration before enabling this feature.</p> : !data?.length ? <p>No call requests yet.</p> :
      <ul className="space-y-5">{data.map(row => <li key={row.id} className="rounded-sm border border-gray-line bg-ivory p-5 text-ink">
        <h2 className="font-display text-2xl">{row.name}</h2>
        <a href={`tel:${row.phone}`} className="mt-2 inline-flex min-h-11 items-center text-base underline">{row.phone}</a>
        <p className="mt-2 text-sm">{row.card_brand} ending {row.card_last4} · No charge taken</p>
        <p className="mt-2 text-sm">{row.status === "contacted" ? "Contacted" : "Awaiting call"} · {new Date(row.requested_at).toLocaleString("en-US", { timeZone: "America/New_York" })} ET</p>
        {!row.notice_sent_at && <p className="mt-2 text-sm">Email notice pending. The request is saved here.</p>}
        <CallRequestActions id={row.id} contacted={row.status === "contacted"} linked={Boolean(row.linked_customer_id)} canLink={canLink} />
      </li>)}</ul>}
  </div>;
}
