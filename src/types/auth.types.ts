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

/** GET /api/v1/auth/invite-info?token= — public, lets the accept page show the
 *  invited email before a password is set. */
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
  /** Ready-made accept link from the backend (APP_BASE_URL + token). Optional —
   *  the frontend falls back to building it from window.location.origin. */
  accept_url?: string | null;
  /** Whether the invite email actually went out. */
  email_sent?: boolean;
  email_channel?: string | null;
  email_error?: string | null;
}

export interface TeamUser {
  id: string;
  email: string;
  full_name?: string | null;
  role: UserRole;
  /** "active" | "disabled" | "invited" */
  status: string;
  access_mode: "all" | "selected";
  assigned_company_ids: string[];
  created_at?: string;
  /** Provider-reported invite-email delivery state:
   *  null | "sent" | "delivered" | "bounced" | "complained" | "failed". */
  email_status?: string | null;
}
