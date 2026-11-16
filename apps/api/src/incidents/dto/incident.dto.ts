import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";
import { incidentStatusEnum, severityEnum, type IncidentStatus, type Severity } from "../../db/schema";

export class CreateIncidentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsIn(severityEnum.enumValues)
  severity: Severity;

  @IsOptional()
  @IsBoolean()
  personalData?: boolean;

  @IsOptional()
  @IsBoolean()
  nis2Significant?: boolean;

  /** Alertes à rattacher dès la création. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID("4", { each: true })
  alertIds?: string[];
}

export class UpdateIncidentDto {
  @IsOptional()
  @IsIn(incidentStatusEnum.enumValues)
  status?: IncidentStatus;

  @IsOptional()
  @IsIn(severityEnum.enumValues)
  severity?: Severity;

  /** null = désassigner. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID("4")
  assigneeId?: string | null;

  @IsOptional()
  @IsBoolean()
  personalData?: boolean;

  /** Incident « important » au sens de NIS2 : déclenche les échéances 24 h / 72 h / 1 mois. */
  @IsOptional()
  @IsBoolean()
  nis2Significant?: boolean;

  /** Explication obligatoire pour passer à RESOLVED ou CLOSED (traçabilité). */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class CommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  text: string;
}

export class LinkAlertsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID("4", { each: true })
  alertIds: string[];
}

export class ListIncidentsQuery {
  @IsOptional()
  @IsIn(incidentStatusEnum.enumValues)
  status?: IncidentStatus;

  @IsOptional()
  @IsIn(severityEnum.enumValues)
  severity?: Severity;

  /** "me" pour « mes incidents ». */
  @IsOptional()
  @ValidateIf((_, v) => v !== "me")
  @IsUUID("4")
  assigneeId?: string;

  @IsOptional()
  // Les paramètres d'URL sont des chaînes : "true" / "false" → booléen (et rien d'autre).
  @Transform(({ value }) => (value === "true" ? true : value === "false" ? false : value))
  @IsBoolean()
  personalData?: boolean;
}
