import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateUserDto } from "./create-user.dto";

const valid = { email: "dpo@exemple.fr", fullName: "Jeanne DPO", password: "UnBonMotDePasse2026", role: "DPO" };

describe("CreateUserDto", () => {
  it("accepte des données valides", async () => {
    expect(await validate(plainToInstance(CreateUserDto, valid))).toHaveLength(0);
  });

  it("refuse un rôle inconnu", async () => {
    const errors = await validate(plainToInstance(CreateUserDto, { ...valid, role: "SUPERADMIN" }));
    expect(errors.map((e) => e.property)).toContain("role");
  });

  it("refuse un mot de passe faible", async () => {
    const errors = await validate(plainToInstance(CreateUserDto, { ...valid, password: "faible" }));
    expect(errors.map((e) => e.property)).toContain("password");
  });
});
