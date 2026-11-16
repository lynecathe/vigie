import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MaxLength(128)
  password: string;
}

/** Mobile : le refresh token est dans le corps. Web : il est dans un cookie httpOnly (corps vide). */
export class RefreshDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  refreshToken?: string;
}
