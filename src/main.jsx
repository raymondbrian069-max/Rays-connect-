import React, { Component, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./style.css";

class AppErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Rays Connect render error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main role="alert" style={{
          minHeight: "100vh", display: "grid", placeContent: "center",
          padding: 24, background: "#0a1020", color: "#f8fafc",
          fontFamily: "system-ui, sans-serif", textAlign: "center"
        }}>
          <h1>Rays Connect couldn't load</h1>
          <p style={{ color: "#cbd5e1" }}>
            Something went wrong while opening the app. Reload the page to try again.
          </p>
          <button onClick={() => window.location.reload()} style={{
            justifySelf: "center", border: 0, borderRadius: 10,
            padding: "12px 18px", background: "#8059e8",
            color: "white", fontWeight: 700
          }}>Reload app</button>
        </main>
      );
    }
    return this.props.children;
  }
}

function InstallAppPrompt() {
  const [installEvent, setInstallEvent] = useState(null);
  const [installed, setInstalled] = useState(
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );

  useEffect(() => {
    const onBeforeInstall = (event) => {
      event.preventDefault();
      setInstallEvent(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Rays Connect service worker registration failed:", error);
      });
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !installEvent) return null;

  const install = async () => {
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
    } catch (error) {
      console.error("Rays Connect installation prompt failed:", error);
    } finally {
      setInstallEvent(null);
    }
  };

  return (
    <aside style={{
      position: "fixed", zIndex: 1000, left: 12, right: 12, bottom: 14,
      maxWidth: 520, margin: "0 auto", padding: "14px 16px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 12, color: "#f8fafc", background: "#202744",
      border: "1px solid #59458f", borderRadius: 14,
      boxShadow: "0 12px 35px #0008"
    }}>
      <div>
        <strong>Install Rays Connect</strong>
        <div style={{ color: "#cbd5e1", fontSize: 12, marginTop: 3 }}>
          Add the app to your home screen.
        </div>
      </div>
      <button onClick={install} style={{
        border: 0, borderRadius: 9, padding: "10px 14px",
        background: "#8059e8", color: "white", fontWeight: 700
      }}>Install</button>
    </aside>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
      <InstallAppPrompt />
    </AppErrorBoundary>
  </React.StrictMode>
);
