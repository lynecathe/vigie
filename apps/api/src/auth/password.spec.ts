import { assertStrongPassword, hashPassword, PASSWORD_POLICY_REGEX, verifyPassword } from "./password";

describe("password", () => {
  it("hache puis vérifie un mot de passe", async () => {
    const hash = await hashPassword("MotDePasse123");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain("MotDePasse123");
    await expect(verifyPassword("MotDePasse123", hash)).resolves.toBe(true);
    await expect(verifyPassword("mauvais", hash)).resolves.toBe(false);
  });

  it("produit un hash différent à chaque fois (sel aléatoire)", async () => {
    expect(await hashPassword("MotDePasse123")).not.toEqual(await hashPassword("MotDePasse123"));
  });

  it("rejette un hash mal formé", async () => {
    await expect(verifyPassword("x", "n'importe quoi")).resolves.toBe(false);
  });

  it.each(["court1A", "toutenminuscule123", "TOUTENMAJUSCULE123", "SansChiffreDuTout"])(
    "refuse le mot de passe faible %s",
    (pwd) => {
      expect(() => assertStrongPassword(pwd)).toThrow();
      expect(PASSWORD_POLICY_REGEX.test(pwd)).toBe(false);
    },
  );

  it("accepte un mot de passe conforme", () => {
    expect(() => assertStrongPassword("UnBonMotDePasse2026")).not.toThrow();
  });
});
