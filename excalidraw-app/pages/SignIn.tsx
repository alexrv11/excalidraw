import { useAuth0 } from "@auth0/auth0-react";
import React, { useEffect } from "react";

// ─── Google icon ──────────────────────────────────────────────────────────────

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </svg>
);

// ─── GitHub icon ──────────────────────────────────────────────────────────────

const GitHubIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"
    />
  </svg>
);

// ─── Excalidraw logo mark ─────────────────────────────────────────────────────

const ExcalidrawMark = () => (
  <svg
    width="40"
    height="40"
    viewBox="0 0 40 40"
    fill="none"
    aria-hidden="true"
  >
    <rect width="40" height="40" rx="10" fill="#6965db" />
    <path
      d="M10 28 L18 12 L26 24 L30 18"
      stroke="white"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <circle cx="30" cy="18" r="2.5" fill="white" />
  </svg>
);

// ─── SignInPage ───────────────────────────────────────────────────────────────

export const SignInPage: React.FC = () => {
  const { loginWithRedirect, isLoading, isAuthenticated } = useAuth0();

  // If already authenticated, go back to the canvas
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      window.location.replace("/");
    }
  }, [isLoading, isAuthenticated]);

  const handleSignIn = () =>
    loginWithRedirect({
      appState: { returnTo: "/" },
    });

  const handleGoogle = () =>
    loginWithRedirect({
      appState: { returnTo: "/" },
      authorizationParams: { connection: "google-oauth2" },
    });

  const handleGitHub = () =>
    loginWithRedirect({
      appState: { returnTo: "/" },
      authorizationParams: { connection: "github" },
    });

  if (isLoading || isAuthenticated) {
    return (
      <div style={styles.page}>
        <div style={styles.spinner} />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Load fonts */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Kalam:wght@700&family=Inter:wght@400;500;600&display=swap"
      />

      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoRow}>
          <ExcalidrawMark />
          <span style={styles.logoText}>Excalidraw</span>
        </div>

        {/* Heading */}
        <h1 style={styles.heading}>Welcome back</h1>
        <p style={styles.subheading}>Sign in to your account to continue</p>

        {/* Social buttons */}
        <div style={styles.socialGroup}>
          <SocialButton icon={<GoogleIcon />} label="Continue with Google" onClick={handleGoogle} />
          <SocialButton icon={<GitHubIcon />} label="Continue with GitHub" onClick={handleGitHub} />
        </div>

        {/* Divider */}
        <div style={styles.divider}>
          <div style={styles.dividerLine} />
          <span style={styles.dividerText}>or</span>
          <div style={styles.dividerLine} />
        </div>

        {/* Email / password via Auth0 Universal Login */}
        <button style={styles.primaryBtn} onClick={handleSignIn}>
          Sign in with email
        </button>

        {/* Back link */}
        <a href="/" style={styles.backLink}>
          ← Back to Excalidraw
        </a>
      </div>
    </div>
  );
};

// ─── Social button ────────────────────────────────────────────────────────────

const SocialButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}> = ({ icon, label, onClick }) => {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      style={{
        ...styles.socialBtn,
        background: hovered ? "#f1f3f9" : "white",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const ACCENT = "#6965db";

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f6f7fb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Inter', system-ui, sans-serif",
    padding: "20px",
  },
  spinner: {
    width: 32,
    height: 32,
    border: `3px solid #e2e4ee`,
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
    gap: 0,
    boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 28,
  },
  logoText: {
    fontFamily: "'Kalam', cursive",
    fontSize: 22,
    fontWeight: 700,
    color: "#0f172a",
  },
  heading: {
    fontFamily: "'Kalam', cursive",
    fontSize: 32,
    fontWeight: 700,
    color: "#0f172a",
    margin: "0 0 8px",
    textAlign: "center",
  },
  subheading: {
    fontSize: 15,
    color: "#64748b",
    margin: "0 0 32px",
    textAlign: "center",
  },
  socialGroup: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 20,
  },
  socialBtn: {
    width: "100%",
    height: 48,
    border: "1.5px solid #e2e4ee",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    fontSize: 15,
    fontWeight: 500,
    color: "#0f172a",
    cursor: "pointer",
    transition: "background 0.15s ease",
    fontFamily: "inherit",
  },
  divider: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: "#e2e4ee",
  },
  dividerText: {
    fontSize: 13,
    color: "#94a3b8",
  },
  primaryBtn: {
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
    marginBottom: 24,
    transition: "background 0.15s ease",
  },
  backLink: {
    fontSize: 13,
    color: "#94a3b8",
    textDecoration: "none",
  },
};
