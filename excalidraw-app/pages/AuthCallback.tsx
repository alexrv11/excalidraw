import { useAuth0 } from "@auth0/auth0-react";
import React, { useEffect } from "react";
import { useSession } from "../hooks/useSession";

/**
 * Rendered at /callback after Auth0 redirects back.
 *
 * Auth0Provider automatically exchanges the authorization code for tokens.
 * Then useSession exchanges the Auth0 access token for our own session JWT.
 *
 * If the user is new and needs an invite code, we show the invite code form.
 * Otherwise, we redirect to the canvas.
 */
export const AuthCallback: React.FC = () => {
  const { error: auth0Error } = useAuth0();
  const {
    isAuthenticated,
    isLoading,
    needsInviteCode,
    error: sessionError,
    submitInviteCode,
    auth0User,
  } = useSession();

  const [inviteCode, setInviteCode] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  // Once session is established, redirect to canvas
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      window.location.replace("/");
    }
  }, [isLoading, isAuthenticated]);

  if (auth0Error) {
    return (
      <div style={styles.page}>
        <p style={styles.error}>
          Authentication failed.{" "}
          <a href="/sign-in" style={styles.link}>
            Try again
          </a>
        </p>
      </div>
    );
  }

  // ── Invite code form ──────────────────────────────────────────────────────
  if (needsInviteCode) {
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!inviteCode.trim()) {
        return;
      }
      setSubmitting(true);
      await submitInviteCode(inviteCode.trim());
      setSubmitting(false);
    };

    return (
      <div style={styles.page}>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Kalam:wght@700&family=Inter:wght@400;500;600&display=swap"
        />
        <div style={styles.card}>
          <h1 style={styles.heading}>Almost there!</h1>
          <p style={styles.sub}>
            {auth0User?.name ? `Welcome, ${auth0User.name}. ` : ""}
            Enter your invite code to get started.
          </p>

          <form onSubmit={handleSubmit} style={styles.form}>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Enter invite code"
              style={styles.input}
              autoFocus
              disabled={submitting}
            />
            {sessionError && <p style={styles.fieldError}>{sessionError}</p>}
            <button type="submit" style={styles.btn} disabled={submitting}>
              {submitting ? "Verifying..." : "Continue"}
            </button>
          </form>

          <a href="/" style={styles.backLink}>
            &larr; Back to Excalidraw
          </a>
        </div>
      </div>
    );
  }

  // ── Loading spinner ───────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={styles.spinner} />
    </div>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const ACCENT = "#6965db";

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Inter', system-ui, sans-serif",
    background: "#f6f7fb",
    padding: 20,
  },
  error: { color: "#dc2626", fontSize: 15 },
  link: { color: ACCENT },
  spinner: {
    width: 36,
    height: 36,
    border: "3px solid #e2e4ee",
    borderTopColor: ACCENT,
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
  },
  card: {
    background: "white",
    border: "1.5px solid #e2e4ee",
    borderRadius: 20,
    padding: "48px 44px 40px",
    width: "100%",
    maxWidth: 420,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
  },
  heading: {
    fontFamily: "'Kalam', cursive",
    fontSize: 28,
    fontWeight: 700,
    color: "#0f172a",
    margin: "0 0 8px",
    textAlign: "center",
  },
  sub: {
    fontSize: 15,
    color: "#64748b",
    margin: "0 0 28px",
    textAlign: "center",
  },
  form: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginBottom: 24,
  },
  input: {
    width: "100%",
    height: 48,
    padding: "0 16px",
    border: "1.5px solid #e2e4ee",
    borderRadius: 10,
    fontSize: 15,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
  },
  fieldError: {
    fontSize: 13,
    color: "#dc2626",
    margin: 0,
  },
  btn: {
    width: "100%",
    height: 48,
    background: ACCENT,
    border: "none",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    color: "white",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  backLink: {
    fontSize: 13,
    color: "#94a3b8",
    textDecoration: "none",
  },
};
