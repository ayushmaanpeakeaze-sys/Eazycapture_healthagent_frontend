import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import AuditFirewallCenter from "./components/AuditFirewallCenter";
import { AuthProvider } from "./components/Auth/AuthProvider";
import "./index.css";

// One-time cleanup: remove stale demo flags.
try {
  window.localStorage.removeItem("eazy.demo.mode");
} catch { /* ignore */ }

// NOTE: StrictMode intentionally omitted — react-apexcharts throws
// "reading 'node'" under StrictMode's dev double-invoke (charts render fine, but
// it spams the console). StrictMode has no effect in production builds anyway.
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <AuthProvider>
      <AuditFirewallCenter />
    </AuthProvider>
  </BrowserRouter>,
);
