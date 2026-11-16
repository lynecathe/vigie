import { useState, type FormEvent } from "react";
import { api } from "../api";
import { ErrorBox, Panel } from "../components";
import { ROLE_LABEL, formatDate } from "../format";
import { useResource } from "../hooks";
import type { Role } from "../types";

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  createdAt: string;
  disabledAt: string | null;
}

export default function UsersPage() {
  const users = useResource<UserRow[]>("/users");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("ANALYST");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const created = await api<UserRow>("/users", { method: "POST", body: { fullName, email, role, password } });
      setDone(`Compte créé pour ${created.fullName}. Transmettez-lui son mot de passe par un canal séparé.`);
      setError(null);
      setFullName("");
      setEmail("");
      setPassword("");
      users.reload();
    } catch (err) {
      setError((err as Error).message);
      setDone(null);
    }
  }

  return (
    <>
      <div className="entete">
        <div>
          <h1>Comptes</h1>
          <p>Chaque rôle ne voit que ce dont il a besoin : le DPO ne voit que les incidents touchant des données personnelles.</p>
        </div>
      </div>
      <div className="deux">
        <section className="panneau" style={{ padding: 0, overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Rôle</th>
                <th>Créé le</th>
              </tr>
            </thead>
            <tbody>
              {users.data?.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.fullName}
                    <div className="discret">{u.email}</div>
                  </td>
                  <td>{ROLE_LABEL[u.role]}</td>
                  <td className="ref">{u.disabledAt ? "Désactivé" : formatDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ErrorBox message={users.error} />
        </section>
        <Panel title="Créer un compte">
          <form className="pile" onSubmit={submit}>
            <label>
              Nom complet
              <input required minLength={2} maxLength={100} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </label>
            <label>
              E-mail
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              Rôle
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Mot de passe initial
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <span className="discret" style={{ fontWeight: 400 }}>
                12 caractères minimum, avec une majuscule, une minuscule et un chiffre.
              </span>
            </label>
            <ErrorBox message={error} />
            {done && <p className="info">{done}</p>}
            <button type="submit">Créer le compte</button>
          </form>
        </Panel>
      </div>
    </>
  );
}
