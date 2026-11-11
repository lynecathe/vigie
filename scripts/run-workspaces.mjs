// Lance un script npm dans tous les workspaces qui le définissent.
// Tant qu'aucune appli n'est initialisée, on ne fait rien (la CI reste verte).
import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const script = process.argv[2];
const roots = ["apps", "packages"];
const workspaces = roots.flatMap((root) =>
  existsSync(root)
    ? readdirSync(root, { withFileTypes: true })
        .filter((d) => d.isDirectory() && existsSync(join(root, d.name, "package.json")))
        .map((d) => join(root, d.name))
    : []
);

if (workspaces.length === 0) {
  console.log(`Aucun workspace initialisé : « ${script} » ignoré.`);
  process.exit(0);
}

execSync(`npm run ${script} --workspaces --if-present`, { stdio: "inherit" });
