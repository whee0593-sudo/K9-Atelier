"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminCalendarMonthGrid } from "@/components/admin/AdminCalendarMonthGrid";
import {
  BlockAllDayDialog,
  BlockTimeDialog,
  CalendarDateActionMenu,
  ManageAvailabilityDialog,
  ViewDayDialog,
  type DateMenuAction,
} from "@/components/admin/CalendarDateActions";
import { AppointmentActionsMenu } from "@/components/admin/AppointmentActionsMenu";
import { AppointmentCornerMark } from "@/components/admin/AppointmentCornerMark";
import {
  availabilityBlockConflictMessage,
  availabilityBlockLabel,
  normalizeAvailabilityBlockInput,
  type AvailabilityBlock,
  type AvailabilityBlockDraft,
} from "@/lib/appointments/availability-blocks";
import { formatMinutesLabel } from "@/lib/appointments/closures";
import type { AdminAppointmentRecord } from "@/lib/appointments/types";
import type { AdminCalendarDay } from "@/lib/appointments/calendar";
import {
  currentBusinessCalendarMonth,
  shiftCalendarMonth,
} from "@/lib/appointments/calendar-month";
import {
  PREVIEW_CALENDAR_MONTH,
  buildPreviewCalendarAppointments,
  buildPreviewCalendarMonth,
  buildPreviewPaidKinds,
} from "@/lib/appointments/calendar-preview";
import type { ChargeKind } from "@/lib/charges/types";
import { formatPrice } from "@/lib/business";
import { formatStaffVisitTiming } from "@/lib/charges/hourly";
import { formatServiceAddress } from "@/lib/travel";

function formatLongDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function applyPreviewAppointments(
  source: AdminAppointmentRecord[],
  date: string,
  cancelledIds: string[],
  moves: AdminAppointmentRecord[],
) {
  const cancelled = new Set(cancelledIds);
  const movedIds = new Set(moves.map((item) => item.id));
  const kept = source.filter(
    (item) => !cancelled.has(item.id) && !movedIds.has(item.id),
  );
  const incoming = moves.filter(
    (item) => item.appointmentDate === date && !cancelled.has(item.id),
  );
  return [...kept, ...incoming].sort((left, right) => {
    return (left.scheduledStart ?? 24 * 60) - (right.scheduledStart ?? 24 * 60);
  });
}

function statusLabel(appointment: AdminAppointmentRecord) {
  if (appointment.awaitingCustomerConfirm) {
    return "Awaiting Customer";
  }
  if (appointment.status === "pending_confirmation") return "Pending Review";
  if (appointment.status === "cancelled") return "Cancelled";
  return "Confirmed";
}

export function AdminCalendar({
  preview = false,
  onAppointmentsChanged,
  reloadToken = 0,
  between,
}: {
  preview?: boolean;
  /** Fired after an operational change (for example cancelling a confirmed visit). */
  onAppointmentsChanged?: () => void;
  /** Bump to reload the month grid (for example after closing a day). */
  reloadToken?: number;
  /** Placed between the month grid and the selected-day appointment list. */
  between?: React.ReactNode;
}) {
  const [month, setMonth] = useState(() =>
    preview ? PREVIEW_CALENDAR_MONTH : currentBusinessCalendarMonth(),
  );
  const [days, setDays] = useState<AdminCalendarDay[]>([]);
  const [today, setToday] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<AdminAppointmentRecord[]>([]);
  const [paidKinds, setPaidKinds] = useState<Record<string, ChargeKind[]>>({});
  const [loadingMonth, setLoadingMonth] = useState(true);
  const [loadingDay, setLoadingDay] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dayVersion, setDayVersion] = useState(0);
  const [previewBlocks, setPreviewBlocks] = useState<AvailabilityBlock[]>([]);
  const [menu, setMenu] = useState<{
    date: string;
    variant: "popover" | "sheet";
    top: number;
    left: number;
  } | null>(null);
  const [dialog, setDialog] = useState<
    | { type: "block-time" | "block-all-day" | "manage" | "view-day"; date: string }
    | null
  >(null);
  const [editingBlock, setEditingBlock] = useState<AvailabilityBlock | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [appointmentMenu, setAppointmentMenu] = useState<{
    id: string;
    variant: "popover" | "sheet";
    top: number;
    left: number;
  } | null>(null);
  const [previewCancelledIds, setPreviewCancelledIds] = useState<string[]>([]);
  const [previewMoves, setPreviewMoves] = useState<AdminAppointmentRecord[]>([]);
  const [blockDayAppointments, setBlockDayAppointments] = useState<
    AdminAppointmentRecord[] | null
  >(null);
  const [blockCheckError, setBlockCheckError] = useState<string | null>(null);
  const router = useRouter();
  const monthLoadId = useRef(0);
  const blockCheckId = useRef(0);
  const blockCheckDate = useRef<string | null>(null);

  const loadMonth = useCallback(async (nextMonth: string) => {
    const requestId = ++monthLoadId.current;
    setLoadingMonth(true);
    setError(null);
    if (preview) {
      if (requestId !== monthLoadId.current) return;
      const body = buildPreviewCalendarMonth(nextMonth);
      setDays(body.days);
      setToday(body.today);
      setSelectedDate((current) => {
        if (current?.startsWith(nextMonth)) return current;
        return body.today.startsWith(nextMonth)
          ? body.today
          : (body.days.find((day) => day.appointmentCount > 0)?.date ??
              body.days[0]?.date ??
              null);
      });
      setLoadingMonth(false);
      return;
    }
    try {
      const response = await fetch(`/api/admin/calendar?month=${nextMonth}`, {
        cache: "no-store",
        credentials: "include",
      });
      const body = (await response.json()) as {
        error?: string;
        today?: string;
        days?: AdminCalendarDay[];
      };
      if (requestId !== monthLoadId.current) return;
      if (!response.ok) {
        setError(body.error ?? "Could not load the calendar.");
        return;
      }
      setDays(body.days ?? []);
      setToday(body.today ?? "");
      setSelectedDate((current) => {
        if (current?.startsWith(nextMonth)) return current;
        return body.today?.startsWith(nextMonth) ? body.today : (body.days?.[0]?.date ?? null);
      });
    } catch {
      if (requestId !== monthLoadId.current) return;
      setError("Could not load the calendar.");
    } finally {
      if (requestId === monthLoadId.current) setLoadingMonth(false);
    }
  }, [preview]);

  useEffect(() => {
    void loadMonth(month);
  }, [loadMonth, month, reloadToken]);

  useEffect(() => {
    if (!selectedDate) return;
    if (preview) {
      const previewAppointments = applyPreviewAppointments(
        buildPreviewCalendarAppointments(selectedDate),
        selectedDate,
        previewCancelledIds,
        previewMoves,
      );
      setAppointments(previewAppointments);
      setPaidKinds(buildPreviewPaidKinds(previewAppointments));
      setLoadingDay(false);
      return;
    }
    let cancelled = false;
    setLoadingDay(true);
    void fetch(`/api/admin/appointments?date=${selectedDate}`, {
      cache: "no-store",
      credentials: "include",
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          error?: string;
          appointments?: AdminAppointmentRecord[];
          paidKinds?: Record<string, ChargeKind[]>;
        };
        if (cancelled) return;
        if (!response.ok) {
          setError(body.error ?? "Could not load that day.");
          return;
        }
        setAppointments(body.appointments ?? []);
        setPaidKinds(body.paidKinds ?? {});
      })
      .catch(() => {
        if (!cancelled) setError("Could not load that day.");
      })
      .finally(() => {
        if (!cancelled) setLoadingDay(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preview, previewCancelledIds, previewMoves, selectedDate, dayVersion]);

  useEffect(() => {
    if (dialog?.type !== "block-all-day" || editingBlock) return;
    const date = dialog.date;
    if (preview) {
      setBlockCheckError(null);
      setBlockDayAppointments(
        applyPreviewAppointments(
          buildPreviewCalendarAppointments(date),
          date,
          previewCancelledIds,
          previewMoves,
        ).filter((item) => item.status !== "cancelled"),
      );
      return;
    }

    const requestId = ++blockCheckId.current;
    if (blockCheckDate.current !== date) {
      blockCheckDate.current = date;
      setBlockDayAppointments(null);
      setBlockCheckError(null);
    }
    void fetch(`/api/admin/appointments?date=${date}`, {
      cache: "no-store",
      credentials: "include",
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          error?: string;
          appointments?: AdminAppointmentRecord[];
        };
        if (requestId !== blockCheckId.current) return;
        if (!response.ok) {
          setBlockCheckError(body.error ?? "Could not check existing appointments.");
          return;
        }
        setBlockCheckError(null);
        setBlockDayAppointments(
          (body.appointments ?? []).filter((item) => item.status !== "cancelled"),
        );
      })
      .catch(() => {
        if (requestId !== blockCheckId.current) return;
        setBlockCheckError("Could not check existing appointments.");
      });
  }, [dialog, editingBlock, preview, previewCancelledIds, previewMoves]);

  const visibleDays = useMemo(() => {
    if (!preview) return days;
    return days.map((day) => {
      const blocks = previewBlocks.filter((block) => block.serviceDate === day.date);
      const source = buildPreviewCalendarAppointments(day.date);
      const touched =
        previewCancelledIds.length > 0 ||
        previewMoves.some((item) => item.appointmentDate === day.date || source.some((row) => row.id === item.id));
      const appointmentCount = touched
        ? applyPreviewAppointments(
            source,
            day.date,
            previewCancelledIds,
            previewMoves,
          ).length
        : day.appointmentCount;
      return {
        ...day,
        appointmentCount,
        blocks,
        availabilityLabel: availabilityBlockLabel(blocks),
      };
    });
  }, [days, preview, previewBlocks, previewCancelledIds, previewMoves]);

  const dialogBlocks = useMemo(() => {
    if (!dialog) return [];
    return visibleDays.find((day) => day.date === dialog.date)?.blocks ?? [];
  }, [dialog, visibleDays]);

  const allDayDates = useMemo(
    () =>
      preview
        ? previewBlocks
            .filter((block) => block.allDay)
            .map((block) => block.serviceDate)
        : undefined,
    [preview, previewBlocks],
  );

  function openMenu(date: string, anchor?: HTMLButtonElement) {
    if (!anchor) return;
    setAppointmentMenu(null);
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    if (mobile) {
      setMenu({ date, variant: "sheet", top: 0, left: 0 });
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const width = 260;
    const estimatedHeight = 280;
    let left = rect.left;
    if (left + width > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - width - 12);
    }
    let top = rect.bottom + 8;
    if (top + estimatedHeight > window.innerHeight - 12) {
      top = Math.max(12, rect.top - estimatedHeight - 8);
    }
    setMenu({ date, variant: "popover", top, left });
  }

  function openAppointmentMenu(id: string, anchor: HTMLElement) {
    setMenu(null);
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    if (mobile) {
      setAppointmentMenu({ id, variant: "sheet", top: 0, left: 0 });
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const width = 300;
    const estimatedHeight = 460;
    let left = rect.left;
    if (left + width > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - width - 12);
    }
    let top = rect.bottom + 8;
    if (top + estimatedHeight > window.innerHeight - 12) {
      top = Math.max(12, rect.top - estimatedHeight - 8);
    }
    setAppointmentMenu({ id, variant: "popover", top, left });
  }

  function appointmentById(id: string) {
    return (
      appointments.find((item) => item.id === id) ??
      blockDayAppointments?.find((item) => item.id === id) ??
      null
    );
  }

  function handleAppointmentChanged(next?: {
    date: string;
    slotStartMinutes: number;
  }) {
    if (preview && appointmentMenu && next) {
      const current = appointmentById(appointmentMenu.id);
      if (current) {
        const moved: AdminAppointmentRecord = {
          ...current,
          appointmentDate: next.date,
          scheduledStart: next.slotStartMinutes,
          appointmentTime: formatMinutesLabel(next.slotStartMinutes),
        };
        setPreviewMoves((existing) => [
          ...existing.filter((item) => item.id !== current.id),
          moved,
        ]);
      }
    }
    setAppointmentMenu(null);
    refreshSelectedDay();
  }

  function handleAppointmentCancelled() {
    if (preview && appointmentMenu) {
      const id = appointmentMenu.id;
      setPreviewCancelledIds((current) =>
        current.includes(id) ? current : [...current, id],
      );
    }
    setAppointmentMenu(null);
    refreshSelectedDay();
  }

  function blocksFor(date: string) {
    return visibleDays.find((day) => day.date === date)?.blocks ?? [];
  }

  function applyPreviewDraft(draft: AvailabilityBlockDraft, ignoreId?: string) {
    const conflict = availabilityBlockConflictMessage(
      blocksFor(draft.serviceDate),
      draft,
      ignoreId,
    );
    if (conflict) {
      setActionError(conflict);
      return false;
    }
    setPreviewBlocks((current) => {
      if (ignoreId) {
        return current.map((block) =>
          block.id === ignoreId ? { ...block, ...draft } : block,
        );
      }
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `preview-${Date.now()}`;
      return [...current, { id, ...draft }];
    });
    setActionError(null);
    setEditingBlock(null);
    setDialog((current) =>
      current?.type === "manage" ? current : null,
    );
    return true;
  }

  async function saveDraft(draft: AvailabilityBlockDraft, ignoreId?: string) {
    const normalized = normalizeAvailabilityBlockInput(draft);
    if (!normalized.ok) {
      setActionError(normalized.error);
      return;
    }
    if (preview) {
      applyPreviewDraft(normalized.value, ignoreId);
      return;
    }
    setActionBusy(true);
    setActionError(null);
    try {
      const response = await fetch(
        ignoreId
          ? `/api/admin/availability-blocks/${ignoreId}`
          : "/api/admin/availability-blocks",
        {
          method: ignoreId ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            ignoreId
              ? {
                  allDay: normalized.value.allDay,
                  startMinutes: normalized.value.startMinutes,
                  endMinutes: normalized.value.endMinutes,
                  reason: normalized.value.reason,
                }
              : {
                  date: normalized.value.serviceDate,
                  allDay: normalized.value.allDay,
                  startMinutes: normalized.value.startMinutes,
                  endMinutes: normalized.value.endMinutes,
                  reason: normalized.value.reason,
                },
          ),
        },
      );
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setActionError(body.error ?? "Could not save that block.");
        return;
      }
      setEditingBlock(null);
      setDialog((current) => (current?.type === "manage" ? current : null));
      await loadMonth(month);
    } catch {
      setActionError("Could not save that block.");
    } finally {
      setActionBusy(false);
    }
  }

  async function removeBlock(block: AvailabilityBlock) {
    if (preview) {
      setPreviewBlocks((current) => current.filter((item) => item.id !== block.id));
      return;
    }
    setRemovingId(block.id);
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/availability-blocks/${block.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setActionError(body.error ?? "Could not remove that block.");
        return;
      }
      await loadMonth(month);
    } catch {
      setActionError("Could not remove that block.");
    } finally {
      setRemovingId(null);
    }
  }

  function runDateAction(action: DateMenuAction) {
    if (!menu) return;
    const date = menu.date;
    setMenu(null);
    setActionError(null);
    setEditingBlock(null);
    if (action === "book") {
      const href = preview
        ? `/admin/book-for-customer/preview?date=${date}`
        : `/admin/book-for-customer?date=${date}`;
      router.push(href);
      return;
    }
    if (action === "view-day") {
      if (date !== selectedDate) {
        setAppointments([]);
        setLoadingDay(true);
      }
      setSelectedDate(date);
      setDialog({ type: "view-day", date });
      return;
    }
    if (action === "block-all-day") {
      blockCheckDate.current = date;
      setBlockCheckError(null);
      setBlockDayAppointments(
        preview
          ? applyPreviewAppointments(
              buildPreviewCalendarAppointments(date),
              date,
              previewCancelledIds,
              previewMoves,
            ).filter((item) => item.status !== "cancelled")
          : null,
      );
    }
    setDialog({ type: action, date });
  }

  function refreshSelectedDay() {
    setDayVersion((current) => current + 1);
    void loadMonth(month);
    onAppointmentsChanged?.();
  }

  return (
    <>
    <section id="calendar">
      <h3 className="text-lg font-medium text-gold-dark">Calendar</h3>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-4">
        <AdminCalendarMonthGrid
          month={month}
          days={visibleDays}
          selectedDate={menu?.date ?? selectedDate}
          loading={loadingMonth}
          onPrevMonth={() => {
            setMenu(null);
            setAppointmentMenu(null);
            setMonth((current) => shiftCalendarMonth(current, -1));
          }}
          onNextMonth={() => {
            setMenu(null);
            setAppointmentMenu(null);
            setMonth((current) => shiftCalendarMonth(current, 1));
          }}
          onSelectDate={openMenu}
        />
      </div>

      {menu ? (
        <CalendarDateActionMenu
          date={menu.date}
          variant={menu.variant}
          top={menu.top}
          left={menu.left}
          hasBlocks={blocksFor(menu.date).length > 0}
          onClose={() => setMenu(null)}
          onAction={runDateAction}
        />
      ) : null}

      {dialog?.type === "block-time" ? (
        <BlockTimeDialog
          key={editingBlock?.id ?? `new-${dialog.date}`}
          date={dialog.date}
          block={editingBlock}
          busy={actionBusy}
          error={actionError}
          onClose={() => {
            setDialog((current) =>
              editingBlock ? { type: "manage", date: dialog.date } : null,
            );
            setEditingBlock(null);
            setActionError(null);
          }}
          onSubmit={(input) =>
            void saveDraft(
              {
                serviceDate: dialog.date,
                allDay: false,
                startMinutes: input.startMinutes,
                endMinutes: input.endMinutes,
                reason: input.reason,
              },
              editingBlock?.id,
            )
          }
        />
      ) : null}

      {dialog?.type === "block-all-day" ? (
        <BlockAllDayDialog
          key={editingBlock?.id ?? `all-${dialog.date}`}
          date={dialog.date}
          block={editingBlock}
          busy={actionBusy}
          error={editingBlock ? actionError : (blockCheckError ?? actionError)}
          appointments={editingBlock ? [] : blockDayAppointments}
          onAppointmentClick={(id, anchor) => {
            openAppointmentMenu(id, anchor);
          }}
          onClose={() => {
            if (appointmentMenu) return;
            setDialog((current) =>
              editingBlock ? { type: "manage", date: dialog.date } : null,
            );
            setEditingBlock(null);
            setActionError(null);
            setBlockCheckError(null);
          }}
          onSubmit={(reason) =>
            void saveDraft(
              {
                serviceDate: dialog.date,
                allDay: true,
                startMinutes: null,
                endMinutes: null,
                reason,
              },
              editingBlock?.id,
            )
          }
        />
      ) : null}

      {dialog?.type === "manage" ? (
        <ManageAvailabilityDialog
          blocks={dialogBlocks}
          busyId={removingId}
          error={actionError}
          onClose={() => {
            setDialog(null);
            setActionError(null);
          }}
          onEdit={(block) => {
            setEditingBlock(block);
            setActionError(null);
            setDialog({
              type: block.allDay ? "block-all-day" : "block-time",
              date: dialog.date,
            });
          }}
          onRemove={(block) => void removeBlock(block)}
        />
      ) : null}

      {dialog?.type === "view-day" ? (
        <ViewDayDialog
          date={dialog.date}
          loading={loadingDay && selectedDate === dialog.date}
          appointments={selectedDate === dialog.date ? appointments : []}
          blocks={dialogBlocks}
          onClose={() => setDialog(null)}
          onAppointmentClick={(id, anchor) => {
            openAppointmentMenu(id, anchor);
          }}
          onBlockClick={() => {
            setActionError(null);
            setEditingBlock(null);
            setDialog({ type: "manage", date: dialog.date });
          }}
        />
      ) : null}

      {appointmentMenu
        ? (() => {
            const appointment = appointmentById(appointmentMenu.id);
            if (!appointment) return null;
            return (
              <AppointmentActionsMenu
                appointment={appointment}
                variant={appointmentMenu.variant}
                top={appointmentMenu.top}
                left={appointmentMenu.left}
                preview={preview}
                paidKinds={paidKinds[appointment.id] ?? []}
                unavailableDates={allDayDates}
                onClose={() => setAppointmentMenu(null)}
                onChanged={handleAppointmentChanged}
                onCancelled={handleAppointmentCancelled}
              />
            );
          })()
        : null}
    </section>
    {between}
    <section>
      <div>
        <h4 className="text-base font-medium text-gold-dark">
          {selectedDate ? formatLongDate(selectedDate) : "Select a day"}
        </h4>
        {selectedDate === today ? (
          <p className="mt-1 text-xs text-text-muted">Today</p>
        ) : null}
        {loadingDay ? (
          <p className="mt-4 text-sm text-text-muted">Loading appointments…</p>
        ) : appointments.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-lavender/30 bg-cream p-6 text-sm text-text-muted">
            No appointments on this day.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {appointments.map((appointment) => (
              <li
                key={appointment.id}
                className="rounded-2xl border border-lavender/30 bg-cream"
              >
                <div
                  role="button"
                  tabIndex={0}
                  data-appointment-id={appointment.id}
                  aria-label={`Appointment actions for ${appointment.petName}`}
                  className="w-full cursor-pointer p-6 text-left"
                  onClick={(event) =>
                    openAppointmentMenu(appointment.id, event.currentTarget)
                  }
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    openAppointmentMenu(appointment.id, event.currentTarget);
                  }}
                >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-gold-dark">
                      {appointment.petName}
                      {appointment.petBreed ? (
                        <span className="font-normal text-text-muted">
                          {" "}
                          · {appointment.petBreed}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-sm text-text-muted">
                      {appointment.customerName ?? appointment.customerEmail}
                      {appointment.customerPhone
                        ? ` · ${appointment.customerPhone}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <AppointmentCornerMark
                      status={appointment.status}
                      vaccinationStatusAtBooking={
                        appointment.vaccinationStatusAtBooking
                      }
                      customerConfirmedAt={appointment.customerConfirmedAt}
                      awaitingCustomerConfirm={
                        appointment.awaitingCustomerConfirm
                      }
                    />
                    <span className="inline-flex w-fit rounded-full bg-lavender-light px-3 py-1 text-xs font-medium text-gold-dark">
                      {appointment.appointmentTime} ·{" "}
                      {statusLabel(appointment)}
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-sm text-text">{appointment.serviceName}</p>
                <p className="mt-1 text-sm text-text-muted">
                  {formatServiceAddress({
                    street: appointment.addressStreet,
                    city: appointment.addressCity,
                    state: appointment.addressState,
                    zip: appointment.addressZip,
                  })}
                </p>
                {appointment.estimatedTotal != null ? (
                  <p className="mt-2 text-sm text-text">
                    Estimated {formatPrice(appointment.estimatedTotal)}
                  </p>
                ) : null}
                <p className="mt-2 text-sm text-gold-dark">
                  {formatStaffVisitTiming(
                    appointment.serviceStartedAt,
                    appointment.serviceEndedAt,
                    appointment.timezone,
                  )}
                </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
    </>
  );
}
