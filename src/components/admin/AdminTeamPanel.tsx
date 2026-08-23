"use client";

import { useCallback, useEffect, useState } from "react";
import type { StaffTeamMember } from "@/lib/staff/team-types";

type LoadState =
  | { status: "loading" }
  | {
      status: "ready";
      members: StaffTeamMember[];
      ownerEmail: string;
    }
  | { status: "error"; message: string; authRequired?: boolean };

function statusLabel(status: StaffTeamMember["status"]) {
  switch (status) {
    case "active":
      return "Active";
    case "pending":
      return "Waiting for your confirmation";
    case "invited":
      return "Confirmed — waiting to sign in";
    case "disabled":
      return "Removed";
    default:
      return status;
  }
}

export function AdminTeamPanel() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [email, setEmail] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    setLoadState({ status: "loading" });
    setActionError(null);

    try {
      const response = await fetch("/api/admin/team", {
        credentials: "include",
      });
      const body = (await response.json()) as {
        error?: string;
        members?: StaffTeamMember[];
        ownerEmail?: string;
      };

      if (response.status === 401) {
        setLoadState({
          status: "error",
          message: "Sign in with the owner email to manage admin accounts.",
          authRequired: true,
        });
        return;
      }

      if (response.status === 403) {
        setLoadState({
          status: "error",
          message: "Only the owner can manage admin accounts.",
        });
        return;
      }

      if (!response.ok || !body.members) {
        setLoadState({
          status: "error",
          message: body.error ?? "Could not load admin accounts.",
        });
        return;
      }

      setLoadState({
        status: "ready",
        members: body.members,
        ownerEmail: body.ownerEmail ?? "penny@k9atelier.com",
      });
    } catch {
      setLoadState({
        status: "error",
        message: "Could not load admin accounts.",
      });
    }
  }, []);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    setAdding(true);
    setActionError(null);
    try {
      const response = await fetch("/api/admin/team", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Could not add this admin.");
      }
      setEmail("");
      await loadTeam();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not add this admin.",
      );
    } finally {
      setAdding(false);
    }
  }

  async function handleConfirm(id: string) {
    setBusyId(id);
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/team/${id}/confirm`, {
        method: "POST",
        credentials: "include",
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Could not confirm this admin.");
      }
      await loadTeam();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Could not confirm this admin.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(member: StaffTeamMember) {
    const confirmed = window.confirm(
      member.status === "active"
        ? `Remove admin access for ${member.email}?`
        : `Remove ${member.email} from the admin list?`,
    );
    if (!confirmed) return;

    setBusyId(member.id);
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/team/${member.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Could not remove this admin.");
      }
      await loadTeam();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not remove this admin.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (loadState.status === "loading") {
    return <p className="text-sm text-text-muted">Loading admin accounts…</p>;
  }

  if (loadState.status === "error") {
    return (
      <div className="rounded-2xl border border-lavender/30 bg-cream p-6">
        <p className="text-sm text-text">{loadState.message}</p>
        {loadState.authRequired ? (
          <a
            href="/login?next=/admin/team"
            className="mt-4 inline-block text-sm font-medium text-gold-dark underline"
          >
            Sign in
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={(event) => void handleAdd(event)}
        className="rounded-2xl border border-lavender/30 bg-cream p-6"
      >
        <h3 className="font-medium text-gold-dark">Add an admin</h3>
        <p className="mt-2 text-sm text-text-muted">
          They will not have admin access until you confirm.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="admin-email">
            Admin email
          </label>
          <input
            id="admin-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@email.com"
            className="w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm text-text"
          />
          <button
            type="submit"
            disabled={adding}
            className="rounded-xl bg-gold px-6 py-2.5 text-sm font-medium text-white hover:bg-gold-dark disabled:opacity-60"
          >
            {adding ? "Adding…" : "Add admin"}
          </button>
        </div>
      </form>

      {actionError ? (
        <p className="text-sm text-red-800" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="space-y-3">
        {loadState.members.map((member) => {
          const isOwner = member.role === "owner";
          const canConfirm =
            !isOwner &&
            (member.status === "pending" || member.status === "disabled");
          const canRemove = !isOwner;
          return (
            <div
              key={member.id}
              className="flex flex-col gap-3 rounded-2xl border border-lavender/30 bg-cream px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-text">{member.email}</p>
                <p className="mt-1 text-sm text-text-muted">
                  {isOwner ? "Owner" : "Admin"} · {statusLabel(member.status)}
                </p>
              </div>
              {isOwner ? null : (
                <div className="flex flex-wrap gap-2">
                  {canConfirm ? (
                    <button
                      type="button"
                      disabled={busyId === member.id}
                      onClick={() => void handleConfirm(member.id)}
                      className="rounded-xl bg-gold px-4 py-2 text-sm font-medium text-white hover:bg-gold-dark disabled:opacity-60"
                    >
                      {busyId === member.id ? "Saving…" : "Confirm"}
                    </button>
                  ) : null}
                  {canRemove ? (
                    <button
                      type="button"
                      disabled={busyId === member.id}
                      onClick={() => void handleRemove(member)}
                      className="rounded-xl border border-lavender/40 px-4 py-2 text-sm text-text-muted hover:border-gold/40 hover:text-text disabled:opacity-60"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
