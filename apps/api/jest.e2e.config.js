/** Tests de bout en bout : nécessitent une base PostgreSQL (DATABASE_URL). */
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  testRegex: ".*\\.e2e-spec\\.ts$",
  transform: { "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.json" }] },
  testTimeout: 30000,
};
