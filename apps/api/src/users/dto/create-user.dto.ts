import { IsEmail, IsIn, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { PASSWORD_POLICY_REGEX } from "../../auth/password";
import { roleEnum, type Role } from "../../db/schema";

export class CreateUserDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @Matches(PASSWORD_POLICY_REGEX, {
    message: "Le mot de passe doit faire au moins 12 caractères avec une majuscule, une minuscule et un chiffre",
  })
  password: string;

  @IsIn(roleEnum.enumValues)
  role: Role;
}
