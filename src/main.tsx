import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./features/auth/AuthProvider";
import "./index.css";

// Remove stale demo flags.
try {
  window.localStorage.removeItem("eazy.demo.mode");
} catch { /* ignore */ }

// StrictMode omitted: its dev double-invoke makes react-apexcharts throw "reading 'node'".
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>,
);
