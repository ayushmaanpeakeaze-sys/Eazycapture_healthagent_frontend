export type UserRole = "admin" | "team_member";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  assigned_company_ids: string[];
}

export interface LoginResponse {
  access_token: string;
  role: UserRole;
  user?: AuthUser;
}

export interface AcceptInviteResponse {
  access_token: string;
  role: UserRole;
}

export interface InviteInfoResponse {
  valid: boolean;
  email: string | null;
  full_name: string | null;
  expired: boolean;
  reason: string | null;
}

export interface InviteUserRequest {
  email: string;
  full_name?: string;
  company_ids: string[];
}

export interface InviteUserResponse {
  user_id?: string;
  invite_token: string;
  email: string;
  status?: string;
  accept_url?: string | null;
  email_sent?: boolean;
  email_channel?: string | null;
  email_error?: string | null;
}

export interface TeamUser {
  id: string;
  email: string;
  full_name?: string | null;
  role: UserRole;
  status: string;
  access_mode: "all" | "selected";
  assigned_company_ids: string[];
  created_at?: string;
  email_status?: string | null;
}
