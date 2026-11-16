import type { ReactNode } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "./auth";
import { OBLIGATION_STATUS_LABEL, ROLE_LABEL, SEVERITY_LABEL, STATUS_LABEL, formatCountdown } from "./format";
import { useNow } from "./hooks";
import type { IncidentStatus, ObligationStatus, Role, Severity } from "./types";

export const SeverityBadge = ({ value }: { value: Severity }) => <span className={`sev ${value}`}>{SEVERITY_LABEL[value]}</span>;

export const StatusBadge = ({ value }: { value: IncidentStatus }) => <span className={`etat ${value}`}>{STATUS_LABEL[value]}</span>;

export const ObligationBadge = ({ value }: { value: ObligationStatus }) => (
  <span className={`etat ${value}`}>{OBLIGATION_STATUS_LABEL[value]}</span>
);

/** Temps restant avant une échéance légale ; affiche le dépassement une fois l'heure passée. */
export function Countdown({ dueAt }: { dueAt: string }) {
  const now = useNow();
  const remaining = (new Date(dueAt).getTime() - now) / 1000;
  if (remaining <= 0)
    return (
      <span className="chrono" role="timer" aria-label={`Échéance dépassée de ${formatCountdown(-remaining)}`}>
        +{formatCountdown(-remaining)}
      </span>
    );
  return (
    <span className="chrono" role="timer" aria-label={`Temps restant ${formatCountdown(remaining)}`}>
      {formatCountdown(remaining)}
    </span>
  );
}

/** Classe d'urgence d'une échéance : retard, moins de 12 h, ou confortable. */
export function urgency(dueAt: string, now: number) {
  const s = (new Date(dueAt).getTime() - now) / 1000;
  if (s <= 0) return "retard";
  if (s < 12 * 3600) return "urgent";
  return "serein";
}

export function Panel({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="panneau">
      {(title || actions) && (
        <div className="entete" style={{ marginBottom: 16 }}>
          {title && <h2>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export const ErrorBox = ({ message }: { message: string | null }) => (message ? <p className="erreur" role="alert">{message}</p> : null);

interface NavItem {
  to: string;
  label: string;
  roles?: Role[];
}

const NAV: NavItem[] = [
  { to: "/", label: "Tableau de bord" },
  { to: "/incidents", label: "Incidents" },
  { to: "/alertes", label: "Alertes à trier", roles: ["ANALYST", "CISO", "ADMIN"] },
  { to: "/echeances", label: "Échéances légales" },
  { to: "/registre", label: "Registre", roles: ["CISO", "DPO", "ADMIN"] },
  { to: "/comptes", label: "Comptes", roles: ["ADMIN"] },
];

export function Layout() {
  const { me, logout, can } = useAuth();
  if (!me) return null;
  return (
    <div className="shell">
      <aside className="mat">
        <Link className="marque" to="/">
          <img src="/vigie.svg" alt="" />
          Vigie
        </Link>
        <nav className="nav" aria-label="Navigation principale">
          {NAV.filter((n) => !n.roles || can(...n.roles)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="moi">
          <strong>{me.fullName}</strong>
          <span>{ROLE_LABEL[me.role]}</span>
          <button className="second" onClick={logout} style={{ marginTop: 8 }}>
            Se déconnecter
          </button>
        </div>
      </aside>
      <main className="pont">
        <Outlet />
      </main>
    </div>
  );
}
