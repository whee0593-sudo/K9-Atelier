export type StaffTeamStatus = "pending" | "invited" | "active" | "disabled";
export type StaffTeamRole = "owner" | "admin";

export type StaffTeamMember = {
  id: string;
  email: string;
  role: StaffTeamRole;
  status: StaffTeamStatus;
  userId: string | null;
  createdAt: string;
};
