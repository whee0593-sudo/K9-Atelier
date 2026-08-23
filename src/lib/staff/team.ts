import { createAdminClient } from "@/lib/supabase/admin";
import { isEmailConfigured, sendEmail, siteUrl } from "@/lib/email/resend";
import { getOwnerSession } from "@/lib/staff/auth";
import {
  isOwnerEmail,
  normalizeStaffEmail,
  OWNER_EMAIL,
} from "@/lib/staff/owner";
import type {
  StaffTeamMember,
  StaffTeamRole,
  StaffTeamStatus,
} from "@/lib/staff/team-types";

export type { StaffTeamMember, StaffTeamRole, StaffTeamStatus } from "@/lib/staff/team-types";

type StaffMemberRow = {
  user_id: string;
  email: string | null;
  role: StaffTeamRole;
  status: "pending" | "active" | "disabled";
  created_at: string;
};

type StaffInviteRow = {
  id: string;
  email: string;
  email_normalized: string;
  confirmed_at: string | null;
  created_at: string;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function findStaffMemberByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
) {
  const { data } = await admin
    .schema("private")
    .from("staff_members")
    .select("user_id, email, role, status, created_at")
    .ilike("email", email)
    .maybeSingle();
  return (data as StaffMemberRow | null) ?? null;
}

async function findUserIdByEmail(email: string) {
  const admin = createAdminClient();
  const normalized = normalizeStaffEmail(email);
  let page = 1;
  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) {
      console.error("listUsers failed:", error.message);
      return null;
    }
    const match = data.users.find(
      (user) => user.email && normalizeStaffEmail(user.email) === normalized,
    );
    if (match) return match.id;
    if (data.users.length < 200) return null;
    page += 1;
  }
  return null;
}

export async function listStaffTeam(): Promise<
  | { members: StaffTeamMember[]; ownerEmail: string }
  | { error: "unauthenticated" | "forbidden" | "server" | "misconfigured" }
> {
  const session = await getOwnerSession();
  if ("error" in session) return { error: session.error };

  try {
    const admin = createAdminClient();
    const [membersResult, invitesResult] = await Promise.all([
      admin
        .schema("private")
        .from("staff_members")
        .select("user_id, email, role, status, created_at")
        .order("created_at", { ascending: true }),
      admin
        .schema("private")
        .from("staff_invites")
        .select("id, email, email_normalized, confirmed_at, created_at")
        .order("created_at", { ascending: true }),
    ]);

    if (membersResult.error || invitesResult.error) {
      const message = `${membersResult.error?.message ?? ""} ${invitesResult.error?.message ?? ""}`;
      console.error("listStaffTeam failed:", message);
      if (/staff_invites|schema cache|column/i.test(message)) {
        return { error: "misconfigured" };
      }
      return { error: "server" };
    }

    const members: StaffTeamMember[] = (
      (membersResult.data ?? []) as StaffMemberRow[]
    ).map((row) => ({
      id: row.user_id,
      email: row.email ?? "",
      role: row.role,
      status: row.status as StaffTeamStatus,
      userId: row.user_id,
      createdAt: row.created_at,
    }));

    const listedEmails = new Set(
      members
        .map((member) => normalizeStaffEmail(member.email))
        .filter(Boolean),
    );

    for (const invite of (invitesResult.data ?? []) as StaffInviteRow[]) {
      if (listedEmails.has(invite.email_normalized)) continue;
      members.push({
        id: invite.id,
        email: invite.email,
        role: "admin",
        status: invite.confirmed_at ? "invited" : "pending",
        userId: null,
        createdAt: invite.created_at,
      });
    }

    if (!members.some((member) => isOwnerEmail(member.email))) {
      members.unshift({
        id: session.user.id,
        email: OWNER_EMAIL,
        role: "owner",
        status: "active",
        userId: session.user.id,
        createdAt: session.user.created_at,
      });
    }

    return { members, ownerEmail: OWNER_EMAIL };
  } catch (error) {
    console.error("listStaffTeam failed:", error);
    return { error: "server" };
  }
}

export async function inviteStaffMember(emailRaw: string): Promise<
  | { member: StaffTeamMember }
  | {
      error: "unauthenticated" | "forbidden" | "conflict" | "server";
      message?: string;
    }
> {
  const session = await getOwnerSession();
  if ("error" in session) return { error: session.error };

  const email = emailRaw.trim();
  if (!isValidEmail(email)) {
    return { error: "conflict", message: "Enter a valid email address." };
  }
  if (isOwnerEmail(email)) {
    return {
      error: "conflict",
      message: "That email is already the owner account.",
    };
  }

  try {
    const admin = createAdminClient();
    const normalized = normalizeStaffEmail(email);
    const { data: existingInvite } = await admin
      .schema("private")
      .from("staff_invites")
      .select("id, email, confirmed_at, created_at")
      .eq("email_normalized", normalized)
      .maybeSingle();

    if (existingInvite) {
      return {
        error: "conflict",
        message: "That email is already on the admin list.",
      };
    }

    const existingMember = await findStaffMemberByEmail(admin, email);

    if (existingMember?.status === "active") {
      return {
        error: "conflict",
        message: "That email is already an active admin.",
      };
    }

    if (existingMember?.status === "pending") {
      return {
        error: "conflict",
        message: "That email is already waiting for confirmation.",
      };
    }

    if (existingMember?.status === "disabled") {
      const { error: restoreError } = await admin
        .schema("private")
        .from("staff_members")
        .update({ status: "pending" })
        .eq("user_id", existingMember.user_id);
      if (restoreError) {
        console.error("inviteStaffMember restore failed:", restoreError.message);
        return { error: "server" };
      }
      return {
        member: {
          id: existingMember.user_id,
          email: existingMember.email ?? email,
          role: "admin",
          status: "pending",
          userId: existingMember.user_id,
          createdAt: existingMember.created_at,
        },
      };
    }

    const { data: inserted, error } = await admin
      .schema("private")
      .from("staff_invites")
      .insert({
        email,
        invited_by: session.user.id,
      })
      .select("id, email, confirmed_at, created_at")
      .single();

    if (error || !inserted) {
      console.error("inviteStaffMember failed:", error?.message);
      return { error: "server" };
    }

    return {
      member: {
        id: inserted.id,
        email: inserted.email,
        role: "admin",
        status: "pending",
        userId: null,
        createdAt: inserted.created_at,
      },
    };
  } catch (error) {
    console.error("inviteStaffMember failed:", error);
    return { error: "server" };
  }
}

export async function confirmStaffMember(id: string): Promise<
  | { ok: true }
  | { error: "unauthenticated" | "forbidden" | "not_found" | "server" }
> {
  const session = await getOwnerSession();
  if ("error" in session) return { error: session.error };

  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { data: invite } = await admin
      .schema("private")
      .from("staff_invites")
      .select("id, email, confirmed_at")
      .eq("id", id)
      .maybeSingle();

    if (invite) {
      await admin
        .schema("private")
        .from("staff_invites")
        .update({
          confirmed_at: now,
          confirmed_by: session.user.id,
        })
        .eq("id", invite.id);

      const userId = await findUserIdByEmail(invite.email);
      if (userId) {
        const { error } = await admin.schema("private").from("staff_members").upsert(
          {
            user_id: userId,
            email: invite.email,
            role: "admin",
            status: "active",
            confirmed_at: now,
            confirmed_by: session.user.id,
          },
          { onConflict: "user_id" },
        );
        if (error) {
          console.error("confirmStaffMember upsert failed:", error.message);
          return { error: "server" };
        }
      }

      await sendAdminConfirmedEmail(invite.email);
      return { ok: true };
    }

    const { data: member } = await admin
      .schema("private")
      .from("staff_members")
      .select("user_id, email, role")
      .eq("user_id", id)
      .maybeSingle();

    if (!member) return { error: "not_found" };
    if (member.role === "owner") return { error: "forbidden" };

    const { error } = await admin
      .schema("private")
      .from("staff_members")
      .update({
        status: "active",
        confirmed_at: now,
        confirmed_by: session.user.id,
      })
      .eq("user_id", member.user_id);

    if (error) {
      console.error("confirmStaffMember update failed:", error.message);
      return { error: "server" };
    }
    if (member.email) await sendAdminConfirmedEmail(member.email);
    return { ok: true };
  } catch (error) {
    console.error("confirmStaffMember failed:", error);
    return { error: "server" };
  }
}

export async function removeStaffMember(id: string): Promise<
  | { ok: true }
  | { error: "unauthenticated" | "forbidden" | "not_found" | "conflict" | "server" }
> {
  const session = await getOwnerSession();
  if ("error" in session) return { error: session.error };

  try {
    const admin = createAdminClient();

    const { data: member } = await admin
      .schema("private")
      .from("staff_members")
      .select("user_id, email, role")
      .eq("user_id", id)
      .maybeSingle();

    if (member) {
      if (member.role === "owner" || isOwnerEmail(member.email)) {
        return { error: "conflict" };
      }
      const { error } = await admin
        .schema("private")
        .from("staff_members")
        .update({ status: "disabled" })
        .eq("user_id", member.user_id);
      if (error) {
        console.error("removeStaffMember disable failed:", error.message);
        return { error: "server" };
      }
      if (member.email) {
        await admin
          .schema("private")
          .from("staff_invites")
          .delete()
          .eq("email_normalized", normalizeStaffEmail(member.email));
      }
      return { ok: true };
    }

    const { data: invite } = await admin
      .schema("private")
      .from("staff_invites")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (!invite) return { error: "not_found" };

    const { error } = await admin
      .schema("private")
      .from("staff_invites")
      .delete()
      .eq("id", invite.id);
    if (error) {
      console.error("removeStaffMember invite delete failed:", error.message);
      return { error: "server" };
    }
    return { ok: true };
  } catch (error) {
    console.error("removeStaffMember failed:", error);
    return { error: "server" };
  }
}

export async function getStaffAccessForEmail(email?: string | null): Promise<{
  isStaff: boolean;
  isOwner: boolean;
  isPending: boolean;
}> {
  if (!email) return { isStaff: false, isOwner: false, isPending: false };
  if (isOwnerEmail(email)) {
    return { isStaff: true, isOwner: true, isPending: false };
  }

  try {
    const admin = createAdminClient();
    const normalized = normalizeStaffEmail(email);
    const member = await findStaffMemberByEmail(admin, email);

    if (member?.status === "active") {
      return {
        isStaff: true,
        isOwner: member.role === "owner",
        isPending: false,
      };
    }

    if (member?.status === "pending") {
      return { isStaff: false, isOwner: false, isPending: true };
    }

    const { data: invite } = await admin
      .schema("private")
      .from("staff_invites")
      .select("confirmed_at")
      .eq("email_normalized", normalized)
      .maybeSingle();

    return {
      isStaff: false,
      isOwner: false,
      isPending: Boolean(invite && !invite.confirmed_at),
    };
  } catch {
    return { isStaff: false, isOwner: false, isPending: false };
  }
}

async function sendAdminConfirmedEmail(email: string) {
  if (!isEmailConfigured()) return;
  const signInUrl = siteUrl("/login?next=/admin");
  await sendEmail({
    to: email,
    subject: "Your K9 Atelier admin access is confirmed",
    text: [
      "Penny confirmed your K9 Atelier admin access.",
      "",
      `Sign in here: ${signInUrl}`,
      "",
      "If you did not expect this email, please contact penny@k9atelier.com.",
    ].join("\n"),
  });
}
