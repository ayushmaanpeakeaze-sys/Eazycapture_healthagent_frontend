import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./features/auth/AuthProvider";
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
      <App />
    </AuthProvider>
  </BrowserRouter>,
);
