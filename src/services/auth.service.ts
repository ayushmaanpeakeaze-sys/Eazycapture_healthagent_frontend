import { AxiosError } from "axios";

import {
  AcceptInviteResponse,
  AuthUser,
  InviteInfoResponse,
  InviteUserRequest,
  InviteUserResponse,
  LoginResponse,
  TeamUser,
} from "../types/auth.types";
import { apiClient } from "./api.client";

const TOKEN_KEY = "eazy.auth.token";
const ROLE_KEY = "eazy.auth.role";

export const authStorage = {
  getToken: () => window.localStorage.getItem(TOKEN_KEY) ?? null,
  getRole: () =>
    (window.localStorage.getItem(ROLE_KEY) as "admin" | "team_member" | null) ??
    null,
  set: (token: string, role: string) => {
    window.localStorage.setItem(TOKEN_KEY, token);
    window.localStorage.setItem(ROLE_KEY, role);
  },
  clear: () => {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(ROLE_KEY);
    window.localStorage.removeItem("eazy.company.id");
  },
  isLoggedIn: () => !!window.localStorage.getItem(TOKEN_KEY)?.trim(),
};

const fmtDetail = (detail: unknown): string | null => {
  if (detail == null) return null;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((d) => {
        if (typeof d === "string") return d;
        if (d && typeof d === "object") {
          const o = d as Record<string, unknown>;
          return (o.msg ?? o.message ?? JSON.stringify(d)) as string;
        }
        return String(d);
      })
      .filter(Boolean);
    return parts.length ? parts.join("; ") : null;
  }
  if (typeof detail === "object") {
    const o = detail as Record<string, unknown>;
    return (
      (o.message as string) ?? (o.error as string) ?? JSON.stringify(detail)
    );
  }
  return String(detail);
};

const wrap = (err: unknown): string => {
  if (err instanceof AxiosError) {
    const d = err.response?.data;
    const detail = fmtDetail(d?.detail);
    if (detail) return detail;
    if (typeof d?.error === "string") return d.error;
    return err.message;
  }
  return err instanceof Error ? err.message : "Request failed";
};

export const login = async (
  email: string,
  password: string,
): Promise<{ ok: true; data: LoginResponse } | { ok: false; error: string }> => {
  try {
    const { data } = await apiClient.post<LoginResponse>(
      "/api/v1/auth/login",
      { email, password },
    );
    authStorage.set(data.access_token, data.role);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: wrap(err) };
  }
};

export interface RegisterOtpRequest {
  email: string;
  password: string;
  firmName?: string;
  fullName?: string;
}

export const requestRegisterOtp = async (
  req: RegisterOtpRequest,
): Promise<
  | { ok: true; emailSent: boolean; expiresInSeconds: number }
  | { ok: false; error: string; status?: number }
> => {
  try {
    const { data } = await apiClient.post<{
      email: string;
      expires_in_seconds: number;
      email_sent: boolean;
    }>("/api/v1/auth/register/request-otp", {
      email: req.email,
      password: req.password,
      full_name: req.fullName?.trim() || undefined,
      firm_name: req.firmName?.trim() || undefined,
    });
    return {
      ok: true,
      emailSent: !!data.email_sent,
      expiresInSeconds: data.expires_in_seconds ?? 600,
    };
  } catch (err) {
    const status = err instanceof AxiosError ? err.response?.status : undefined;
    return { ok: false, error: wrap(err), status };
  }
};

export const verifyRegisterOtp = async (
  email: string,
  code: string,
): Promise<
  { ok: true; data: LoginResponse } | { ok: false; error: string; status?: number }
> => {
  try {
    const { data } = await apiClient.post<LoginResponse>(
      "/api/v1/auth/register/verify",
      { email, code },
    );
    if (data.access_token) authStorage.set(data.access_token, data.role);
    return { ok: true, data };
  } catch (err) {
    const status = err instanceof AxiosError ? err.response?.status : undefined;
    return { ok: false, error: wrap(err), status };
  }
};

export const fetchInviteInfo = async (
  token: string,
): Promise<InviteInfoResponse | null> => {
  try {
    const { data } = await apiClient.get<InviteInfoResponse>(
      `/api/v1/auth/invite-info?token=${encodeURIComponent(token)}`,
    );
    return data;
  } catch {
    return null;
  }
};

export const getMe = async (): Promise<AuthUser | null> => {
  try {
    const { data } = await apiClient.get<AuthUser>("/api/v1/auth/me");
    return data;
  } catch {
    return null;
  }
};

export const acceptInvite = async (
  inviteToken: string,
  password: string,
  fullName?: string,
): Promise<
  { ok: true; data: AcceptInviteResponse } | { ok: false; error: string }
> => {
  try {
    const { data } = await apiClient.post<AcceptInviteResponse>(
      "/api/v1/auth/accept-invite",
      {
        invite_token: inviteToken,
        password,
        ...(fullName?.trim() ? { full_name: fullName.trim() } : {}),
      },
    );
    authStorage.set(data.access_token, data.role);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: wrap(err) };
  }
};

export const inviteUser = async (
  payload: InviteUserRequest & { access_mode: "all" | "selected" },
): Promise<
  { ok: true; data: InviteUserResponse } | { ok: false; error: string }
> => {
  try {
    const { data } = await apiClient.post<InviteUserResponse>(
      "/api/v1/auth/invite",
      payload,
    );
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: wrap(err) };
  }
};

export const listUsersResult = async (): Promise<{
  ok: boolean;
  users: TeamUser[];
  error?: string;
}> => {
  try {
    const { data } = await apiClient.get<{ users: TeamUser[] } | TeamUser[]>(
      "/api/v1/auth/users",
    );
    const users = Array.isArray(data)
      ? data
      : (data as { users: TeamUser[] }).users ?? [];
    return { ok: true, users };
  } catch (err) {
    return {
      ok: false,
      users: [],
      error: err instanceof Error ? err.message : "Could not load team.",
    };
  }
};

export const listUsers = async (): Promise<TeamUser[]> =>
  (await listUsersResult()).users;

export const setUserCompanies = async (
  userId: string,
  companyIds: string[],
  accessMode: "all" | "selected" = "selected",
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await apiClient.put(`/api/v1/auth/users/${encodeURIComponent(userId)}/companies`, {
      access_mode: accessMode,
      company_ids: accessMode === "all" ? [] : companyIds,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: wrap(err) };
  }
};

export const disableUser = async (
  userId: string,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await apiClient.post(`/api/v1/auth/users/${encodeURIComponent(userId)}/disable`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: wrap(err) };
  }
};

export const enableUser = async (
  userId: string,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await apiClient.post(`/api/v1/auth/users/${encodeURIComponent(userId)}/enable`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: wrap(err) };
  }
};

export const removeUser = async (
  userId: string,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await apiClient.delete(`/api/v1/auth/users/${encodeURIComponent(userId)}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: wrap(err) };
  }
};

export const resendInvite = async (
  userId: string,
): Promise<{ ok: true; data: InviteUserResponse } | { ok: false; error: string }> => {
  try {
    const { data } = await apiClient.post<InviteUserResponse>(
      `/api/v1/auth/users/${encodeURIComponent(userId)}/resend-invite`,
    );
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: wrap(err) };
  }
};
