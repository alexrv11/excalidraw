import { useAuth0 } from "@auth0/auth0-react";
import React, { useEffect } from "react";

/**
 * Rendered at /callback after Auth0 redirects back.
 * Auth0Provider automatically exchanges the code for tokens and fires
 * onRedirectCallback (defined in App.tsx) which navigates to the final page.
 * This component just shows a spinner while that happens.
 */
export const AuthCallback: React.FC = () => {
  const { error, isAuthenticated, isLoading } = useAuth0();

  // Fallback: if somehow already authenticated and onRedirectCallback didn't fire
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      window.location.replace("/");
    }
  }, [isLoading, isAuthenticated]);

  if (error) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <p style={{ color: "#dc2626", fontSize: 15 }}>
          Authentication failed.{" "}
          <a href="/sign-in" style={{ color: "#6965db" }}>
            Try again
          </a>
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div
        style={{
          width: 36,
          height: 36,
          border: "3px solid #e2e4ee",
          borderTopColor: "#6965db",
          borderRadius: "50%",
          animation: "spin 0.7s linear infinite",
        }}
      />
    </div>
  );
};
