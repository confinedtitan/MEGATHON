import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useAuth } from "./auth/AuthContext";
import { Login } from "./pages/Login";
import { Overview } from "./pages/Overview";
import { Pharmacy } from "./pages/Pharmacy";
import { Distributor } from "./pages/Distributor";
import { Manufacturer } from "./pages/Manufacturer";
import { Regulator } from "./pages/Regulator";
import { AuditLedger } from "./pages/AuditLedger";
import { BatchTimeline } from "./pages/BatchTimeline";
import type { JSX } from "react";

function Guard({ children, roles }: { children: JSX.Element; roles?: string[] }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role) && user.role !== "Regulator") {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Layout><Overview /></Layout>} />
      <Route path="/pharmacy" element={<Layout><Guard roles={["Pharmacy"]}><Pharmacy /></Guard></Layout>} />
      <Route path="/distributor" element={<Layout><Guard roles={["Distributor"]}><Distributor /></Guard></Layout>} />
      <Route path="/manufacturer" element={<Layout><Guard roles={["Manufacturer"]}><Manufacturer /></Guard></Layout>} />
      <Route path="/regulator" element={<Layout><Guard roles={["Regulator"]}><Regulator /></Guard></Layout>} />
      <Route path="/audit" element={<Layout><Guard><AuditLedger /></Guard></Layout>} />
      <Route path="/batches/:batchNumber" element={<Layout><Guard><BatchTimeline /></Guard></Layout>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
