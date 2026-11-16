import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth";
import { Layout } from "./components";
import AlertsPage from "./pages/Alerts";
import DashboardPage from "./pages/Dashboard";
import IncidentDetailPage from "./pages/IncidentDetail";
import IncidentsPage from "./pages/Incidents";
import LoginPage from "./pages/Login";
import ObligationsPage from "./pages/Obligations";
import RegisterPage from "./pages/Register";
import UsersPage from "./pages/Users";
import type { Role } from "./types";

function RequireAuth({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="vide">Ouverture de la session…</p>;
  if (!me) return <Navigate to="/connexion" replace state={{ from: location.pathname }} />;
  return children;
}

function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { can } = useAuth();
  return can(...roles) ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="incidents" element={<IncidentsPage />} />
        <Route path="incidents/:id" element={<IncidentDetailPage />} />
        <Route
          path="alertes"
          element={
            <RequireRole roles={["ANALYST", "CISO", "ADMIN"]}>
              <AlertsPage />
            </RequireRole>
          }
        />
        <Route path="echeances" element={<ObligationsPage />} />
        <Route
          path="registre"
          element={
            <RequireRole roles={["CISO", "DPO", "ADMIN"]}>
              <RegisterPage />
            </RequireRole>
          }
        />
        <Route
          path="comptes"
          element={
            <RequireRole roles={["ADMIN"]}>
              <UsersPage />
            </RequireRole>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
