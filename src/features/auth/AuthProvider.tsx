import { createContext, lazy, ReactNode, Suspense, useContext, useEffect, useState } from "react";

import { authStorage, getMe } from "../../services/auth.service";
import { AuthUser, UserRole } from "../../types/auth.types";

interface AuthState {
  isLoggedIn: boolean;
  role: UserRole | null;
  me: AuthUser | null;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  isLoggedIn: false,
  role: null,
  me: null,
  logout: () => {},
  refresh: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(authStorage.isLoggedIn());
  const [role, setRole] = useState<UserRole | null>(authStorage.getRole());
  const [me, setMe] = useState<AuthUser | null>(null);

  const refresh = async () => {
    const user = await getMe();
    if (user) {
      setMe(user);
      setRole(user.role);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      refresh();
    }
  }, [isLoggedIn]);

  const logout = () => {
    authStorage.clear();
    setIsLoggedIn(false);
    setRole(null);
    setMe(null);
  };

  const handleLoggedIn = () => {
    setIsLoggedIn(true);
    setRole(authStorage.getRole());
  };

  // The accept-invite link must work no matter the current session — an admin
  // testing the link, or anyone with a stale token, should still land on the
  // password screen. So this check wins over the logged-in/out branch.
  const inviteToken = new URLSearchParams(window.location.search).get("token");
  const isAcceptInvite =
    window.location.pathname === "/accept-invite" && !!inviteToken;
  // Dedicated team-member login page (reached via the "Log in as a team member"
  // link on the main sign-in). Same login, separate screen.
  const isTeamLogin = window.location.pathname === "/team-login";

  return (
    <AuthContext.Provider value={{ isLoggedIn, role, me, logout, refresh }}>
      {isAcceptInvite ? (
        <AcceptInviteGate token={inviteToken as string} />
      ) : isLoggedIn ? (
        children
      ) : isTeamLogin ? (
        <TeamLoginGate onLoggedIn={handleLoggedIn} />
      ) : (
        <LoginGateInner onLoggedIn={handleLoggedIn} />
      )}
    </AuthContext.Provider>
  );
};

const LazyAuthSlider = lazy(() =>
  import("./AuthSlider").then((m) => ({ default: m.AuthSlider })),
);
const LazyTeamLoginPage = lazy(() =>
  import("./TeamLoginPage").then((m) => ({ default: m.TeamLoginPage })),
);
const LazyAcceptInvitePage = lazy(() =>
  import("./AcceptInvitePage").then((m) => ({ default: m.AcceptInvitePage })),
);

const LoginGateInner = ({ onLoggedIn }: { onLoggedIn: () => void }) => (
  <Suspense fallback={null}>
    <LazyAuthSlider onLoggedIn={onLoggedIn} />
  </Suspense>
);

const TeamLoginGate = ({ onLoggedIn }: { onLoggedIn: () => void }) => (
  <Suspense fallback={null}>
    <LazyTeamLoginPage onLoggedIn={onLoggedIn} />
  </Suspense>
);

const AcceptInviteGate = ({ token }: { token: string }) => (
  <Suspense fallback={null}>
    <LazyAcceptInvitePage
      inviteToken={token}
      onAccepted={() => {
        // acceptInvite() already stored the new JWT — now drop the ?token from
        // the URL and load the dashboard (as the invitee) with a clean reload.
        window.location.href = `${window.location.origin}/`;
      }}
    />
  </Suspense>
);
