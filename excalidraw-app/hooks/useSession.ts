/**
 * useSession — Pattern B session management.
 *
 * Flow:
 *   1. Auth0 authenticates the user (unchanged)
 *   2. After Auth0 login, exchange the Auth0 access token for our own
 *      session JWT via POST /api/v1/auth/session
 *   3. Store the session token + user info in localStorage
 *   4. All subsequent API calls use the session token
 *
 * First-time users must provide an invite code. If the backend returns
 * 403 "invite code required", the hook exposes `needsInviteCode = true`
 * so the UI can prompt for it.
 */

import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SessionUser {
  sub: string;
  email: string;
  name: string;
  role: "user" | "admin";
}

interface SessionState {
  token: string;
  user: SessionUser;
}

// ─── LocalStorage keys ───────────────────────────────────────────────────────

const SESSION_KEY = "excalidraw-session";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readSession(): SessionState | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }
    const data = JSON.parse(raw) as SessionState;

    // Check if token is expired by decoding the payload
    const payload = JSON.parse(atob(data.token.split(".")[1]));
    if (Date.now() / 1000 > payload.exp) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return data;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function writeSession(state: SessionState) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(state));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// ─── API ─────────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_APP_AWS_API_URL ?? "";

async function createSession(
  auth0Token: string,
  inviteCode?: string,
): Promise<
  | { ok: true; token: string; user: SessionUser }
  | { ok: false; needsInviteCode: boolean; error: string }
> {
  const body: Record<string, unknown> = { auth0Token };
  if (inviteCode) {
    body.inviteCode = inviteCode;
  }

  const res = await fetch(`${API_BASE}/api/v1/auth/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.ok) {
    const data = await res.json();
    return { ok: true, token: data.token, user: data.user };
  }

  const errBody = await res.json().catch(() => ({ error: "unknown error" }));
  const needsInviteCode =
    res.status === 403 && /invite code required/i.test(errBody.error ?? "");
  return { ok: false, needsInviteCode, error: errBody.error ?? "session creation failed" };
}

async function createLocalDevSession(
  email: string,
  name: string,
  role: string,
): Promise<
  | { ok: true; token: string; user: SessionUser }
  | { ok: false; needsInviteCode: false; error: string }
> {
  const res = await fetch(`${API_BASE}/api/v1/auth/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ localDev: true, email, name, role }),
  });

  if (res.ok) {
    const data = await res.json();
    return { ok: true, token: data.token, user: data.user };
  }

  const errBody = await res.json().catch(() => ({ error: "unknown error" }));
  return { ok: false, needsInviteCode: false, error: errBody.error ?? "session creation failed" };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSession() {
  const {
    isAuthenticated: auth0Authenticated,
    isLoading: auth0Loading,
    getAccessTokenSilently,
    logout: auth0Logout,
    user: auth0User,
  } = useAuth0();

  const [session, setSession] = useState<SessionState | null>(readSession);
  const [needsInviteCode, setNeedsInviteCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExchanging, setIsExchanging] = useState(false);

  // Prevent duplicate exchange attempts
  const exchangingRef = useRef(false);

  // Exchange Auth0 token for session token
  const exchangeToken = useCallback(
    async (inviteCode?: string) => {
      if (exchangingRef.current && !inviteCode) {
        return;
      }
      exchangingRef.current = true;
      setIsExchanging(true);
      setError(null);

      try {
        const auth0Token = await getAccessTokenSilently();
        if (!auth0Token) {
          setError("failed to get Auth0 token");
          return;
        }
        const result = await createSession(auth0Token, inviteCode);

        if (result.ok) {
          const state: SessionState = {
            token: result.token,
            user: result.user,
          };
          writeSession(state);
          setSession(state);
          setNeedsInviteCode(false);
        } else if (result.needsInviteCode) {
          setNeedsInviteCode(true);
        } else {
          setError(result.error);
        }
      } catch (err: any) {
        setError(err.message ?? "failed to exchange token");
      } finally {
        setIsExchanging(false);
        exchangingRef.current = false;
      }
    },
    [getAccessTokenSilently],
  );

  // Auto-exchange when Auth0 is authenticated but no session exists
  useEffect(() => {
    if (auth0Authenticated && !auth0Loading && !session && !needsInviteCode) {
      exchangeToken();
    }
  }, [auth0Authenticated, auth0Loading, session, needsInviteCode, exchangeToken]);

  // Logout: clear session + Auth0
  const logout = useCallback(() => {
    clearSession();
    setSession(null);
    setNeedsInviteCode(false);

    // Fire-and-forget: call backend logout if we have a token
    const token = readSession()?.token;
    if (token) {
      fetch(`${API_BASE}/api/v1/auth/logout`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      }).catch(() => {});
    }

    auth0Logout({ logoutParams: { returnTo: window.location.origin } });
  }, [auth0Logout]);

  // Submit invite code (called from UI when needsInviteCode is true)
  const submitInviteCode = useCallback(
    (code: string) => exchangeToken(code),
    [exchangeToken],
  );

  return {
    // Session state
    user: session?.user ?? null,
    sessionToken: session?.token ?? null,
    isAuthenticated: !!session,
    isLoading: auth0Loading || isExchanging,
    needsInviteCode,
    error,

    // Auth0 user (available during invite code prompt, before session exists)
    auth0User,
    auth0Authenticated,

    // Actions
    logout,
    submitInviteCode,

    // For local dev mode (no Auth0)
    loginLocalDev: async (email: string, name: string, role = "admin") => {
      setIsExchanging(true);
      setError(null);
      try {
        const result = await createLocalDevSession(email, name, role);
        if (result.ok) {
          const state: SessionState = { token: result.token, user: result.user };
          writeSession(state);
          setSession(state);
        } else {
          setError(result.error);
        }
      } finally {
        setIsExchanging(false);
      }
    },
  };
}
