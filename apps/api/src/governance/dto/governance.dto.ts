import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { obligationKindEnum, type ObligationKind } from "../../db/schema";

export class SetControlsDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID("4", { each: true })
  controlIds: string[];
}

export class CreateControlDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  framework: string;

  @Matches(/^[A-Za-z0-9.-]{1,20}$/, { message: "Code de contrôle invalide (ex. 5.24)" })
  code: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

/** Paramètres d'URL /incidents/:id/obligations/:kind (tous déclarés : la validation refuse l'inconnu). */
export class IncidentObligationParams {
  @IsUUID("4")
  id: string;

  @IsIn(obligationKindEnum.enumValues)
  kind: ObligationKind;
}

export class DecideDto {
  @IsIn(["NOTIFY", "NOT_REQUIRED"])
  decision: "NOTIFY" | "NOT_REQUIRED";

  /** Obligatoire si la notification n'est pas requise : elle doit être documentée (RGPD, art. 33.5). */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  justification?: string;
}

export class SubmitDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;

  /** Date d'envoi réelle si elle diffère de maintenant (ISO 8601). */
  @IsOptional()
  @IsDateString()
  submittedAt?: string;

  /** Obligatoire si l'envoi est en retard (RGPD, art. 33.1). */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  delayReason?: string;
}

export class RegisterQuery {
  @IsOptional()
  @IsIn(["json", "csv"])
  format?: "json" | "csv";

  @IsOptional()
  @Transform(({ value }) => (value === "true" ? true : value === "false" ? false : value))
  @IsBoolean()
  personalDataOnly?: boolean;
}
