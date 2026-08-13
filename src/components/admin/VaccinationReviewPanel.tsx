"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { PendingVaccinationRecord } from "@/lib/vaccinations/staff-service";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; records: PendingVaccinationRecord[] }
  | { status: "error"; message: string; authRequired?: boolean };

function formatShortDate(iso: string | null): string {
  if (!iso) return "Not provided";
  const date = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VaccinationReviewPanel() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    setLoadState({ status: "loading" });
    setActionError(null);

    try {
      const response = await fetch("/api/admin/vaccinations", {
        credentials: "include",
      });
      const body = (await response.json()) as {
        error?: string;
        records?: PendingVaccinationRecord[];
      };

      if (response.status === 401) {
        setLoadState({
          status: "error",
          message: "Sign in with your team email to review vaccination records.",
          authRequired: true,
        });
        return;
      }

      if (response.status === 403) {
        setLoadState({
          status: "error",
          message:
            "Your account is not authorized for staff review. Contact Penny if you need access.",
        });
        return;
      }

      if (!response.ok) {
        setLoadState({
          status: "error",
          message: body.error ?? "Could not load pending records.",
        });
        return;
      }

      setLoadState({
        status: "ready",
        records: body.records ?? [],
      });
    } catch {
      setLoadState({
        status: "error",
        message: "Could not load pending records.",
      });
    }
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  async function openFile(recordId: string) {
    setActionError(null);
    setBusyId(recordId);

    try {
      const response = await fetch(
        `/api/admin/vaccinations/${recordId}/file`,
        { credentials: "include" },
      );
      const body = (await response.json()) as { error?: string; url?: string };

      if (!response.ok || !body.url) {
        setActionError(body.error ?? "Could not open file.");
        return;
      }

      window.open(body.url, "_blank", "noopener,noreferrer");
    } catch {
      setActionError("Could not open file.");
    } finally {
      setBusyId(null);
    }
  }

  async function reviewRecord(
    recordId: string,
    status: "verified" | "rejected",
  ) {
    setActionError(null);
    setBusyId(recordId);

    try {
      const response = await fetch(`/api/admin/vaccinations/${recordId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        setActionError(body.error ?? "Could not update record.");
        return;
      }

      if (loadState.status === "ready") {
        setLoadState({
          status: "ready",
          records: loadState.records.filter((record) => record.id !== recordId),
        });
      }
    } catch {
      setActionError("Could not update record.");
    } finally {
      setBusyId(null);
    }
  }

  if (loadState.status === "loading") {
    return (
      <p className="mt-8 text-sm text-text-muted">Loading pending records…</p>
    );
  }

  if (loadState.status === "error") {
    return (
      <div className="mt-8 rounded-2xl border border-lavender/30 bg-cream p-6">
        <p className="text-sm text-text">{loadState.message}</p>
        {loadState.authRequired ? (
          <Link
            href="/login?next=/admin/vaccinations"
            className="mt-4 inline-block text-sm font-medium text-gold-dark underline"
          >
            Sign in
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => void loadRecords()}
            className="mt-4 text-sm font-medium text-gold-dark underline"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  const { records } = loadState;

  return (
    <div className="mt-8 space-y-6">
      {actionError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </p>
      ) : null}

      {records.length === 0 ? (
        <div className="rounded-2xl border border-lavender/30 bg-cream p-8 text-center">
          <p className="font-medium text-gold-dark">All caught up</p>
          <p className="mt-2 text-sm text-text-muted">
            No vaccination records are awaiting staff review.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {records.map((record) => {
            const busy = busyId === record.id;
            const customerLabel =
              record.customerName ?? record.customerEmail ?? "Unknown customer";

            return (
              <li
                key={record.id}
                className="rounded-2xl border border-lavender/30 bg-cream p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-medium text-gold-dark">
                      {record.petName}
                      {record.petBreed ? (
                        <span className="font-normal text-text-muted">
                          {" "}
                          · {record.petBreed}
                        </span>
                      ) : null}
                    </h3>
                    <p className="mt-1 text-sm text-text-muted">
                      {customerLabel}
                      {record.customerEmail && record.customerName
                        ? ` (${record.customerEmail})`
                        : null}
                    </p>
                  </div>
                  <span className="inline-flex w-fit rounded-full bg-lavender-light px-3 py-1 text-xs font-medium text-gold-dark">
                    Pending review
                  </span>
                </div>

                <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-text-muted">Uploaded</dt>
                    <dd className="text-text">
                      {formatShortDate(record.createdAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Expiration</dt>
                    <dd className="text-text">
                      {formatShortDate(record.expirationDate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">File</dt>
                    <dd className="text-text">
                      {record.originalFilename ?? "Vaccination record"} ·{" "}
                      {formatFileSize(record.fileSizeBytes)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Format</dt>
                    <dd className="text-text">{record.mimeType}</dd>
                  </div>
                </dl>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void openFile(record.id)}
                    className="rounded-xl border border-lavender/40 px-4 py-2 text-sm font-medium text-text transition hover:border-gold/40 disabled:opacity-50"
                  >
                    View file
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void reviewRecord(record.id, "verified")}
                    className="rounded-xl bg-gold px-4 py-2 text-sm font-medium text-cream transition hover:bg-gold-dark disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void reviewRecord(record.id, "rejected")}
                    className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {records.length > 0 ? (
        <button
          type="button"
          onClick={() => void loadRecords()}
          className="text-sm text-text-muted underline hover:text-text"
        >
          Refresh list
        </button>
      ) : null}
    </div>
  );
}
