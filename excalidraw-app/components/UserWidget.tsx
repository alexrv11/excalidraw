import { useAuth0 } from "@auth0/auth0-react";
import React, { useRef, useState, useEffect } from "react";

/**
 * Shown in the top-right of the canvas.
 * - Not authenticated → "Sign in" button
 * - Authenticated → avatar circle that opens a small dropdown (name + sign out)
 */
export const UserWidget: React.FC = () => {
  const { isAuthenticated, isLoading, user, logout } = useAuth0();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (isLoading) {
    return <div style={styles.placeholder} />;
  }

  if (!isAuthenticated || !user) {
    return (
      <a href="/sign-in" style={styles.signInBtn}>
        Sign in
      </a>
    );
  }

  const initials = (user.name ?? user.email ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={styles.avatarBtn}
        title={user.name ?? user.email}
        aria-label="Account menu"
      >
        {user.picture ? (
          <img
            src={user.picture}
            alt={user.name ?? "User avatar"}
            style={styles.avatarImg}
          />
        ) : (
          <span style={styles.avatarInitials}>{initials}</span>
        )}
      </button>

      {open && (
        <div style={styles.dropdown}>
          <div style={styles.dropdownHeader}>
            <span style={styles.dropdownName}>{user.name}</span>
            <span style={styles.dropdownEmail}>{user.email}</span>
          </div>
          <div style={styles.dropdownDivider} />
          <button
            style={styles.dropdownItem}
            onClick={() =>
              logout({ logoutParams: { returnTo: window.location.origin } })
            }
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
};

const ACCENT = "#6965db";

const styles: Record<string, React.CSSProperties> = {
  placeholder: {
    width: 36,
    height: 36,
  },
  signInBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingInline: 16,
    background: `${ACCENT}18`,
    border: `1.5px solid ${ACCENT}40`,
    borderRadius: 8,
    color: ACCENT,
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "inherit",
    textDecoration: "none",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: `2px solid ${ACCENT}`,
    padding: 0,
    overflow: "hidden",
    cursor: "pointer",
    background: ACCENT,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  avatarInitials: {
    fontSize: 13,
    fontWeight: 700,
    color: "white",
    letterSpacing: "0.02em",
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    background: "white",
    border: "1.5px solid #e2e4ee",
    borderRadius: 12,
    boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
    minWidth: 200,
    zIndex: 9999,
    overflow: "hidden",
  },
  dropdownHeader: {
    padding: "14px 16px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  dropdownName: {
    fontSize: 14,
    fontWeight: 600,
    color: "#0f172a",
  },
  dropdownEmail: {
    fontSize: 12,
    color: "#94a3b8",
  },
  dropdownDivider: {
    height: 1,
    background: "#f1f3f9",
  },
  dropdownItem: {
    width: "100%",
    padding: "11px 16px",
    textAlign: "left",
    background: "none",
    border: "none",
    fontSize: 14,
    color: "#475569",
    cursor: "pointer",
    fontFamily: "inherit",
  },
};
