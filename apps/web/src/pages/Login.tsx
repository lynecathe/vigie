import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api";
import { useAuth } from "../auth";

export default function LoginPage() {
  const { me, login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  if (!loading && me) return <Navigate to={from} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? "Trop de tentatives. Patientez une minute avant de réessayer."
          : "E-mail ou mot de passe incorrect.",
      );
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="connexion">
      <div className="connexion-mat">
        <h1>
          <img src="/vigie.svg" alt="" />
          Vigie
        </h1>
        <p className="accroche">Du premier signal SOC à la notification CNIL ou ANSSI : chaque incident, chaque échéance légale, au même endroit.</p>
        <p className="discret" style={{ color: "#8fa1b5" }}>
          Accès réservé à l'équipe sécurité. Les connexions sont journalisées.
        </p>
      </div>
      <div className="connexion-form">
        <form onSubmit={submit}>
          <h2>Prendre le quart</h2>
          <label>
            E-mail professionnel
            <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Mot de passe
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p className="erreur" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy}>
            {busy ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
