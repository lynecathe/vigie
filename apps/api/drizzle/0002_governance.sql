CREATE TYPE "public"."obligation_decision" AS ENUM('PENDING', 'NOTIFY', 'NOT_REQUIRED');--> statement-breakpoint
CREATE TYPE "public"."obligation_kind" AS ENUM('GDPR_NOTIFICATION', 'NIS2_EARLY_WARNING', 'NIS2_NOTIFICATION', 'NIS2_FINAL_REPORT');--> statement-breakpoint
ALTER TYPE "public"."incident_event_type" ADD VALUE 'NIS2_CHANGED';--> statement-breakpoint
ALTER TYPE "public"."incident_event_type" ADD VALUE 'CONTROLS_UPDATED';--> statement-breakpoint
ALTER TYPE "public"."incident_event_type" ADD VALUE 'OBLIGATION_DECIDED';--> statement-breakpoint
ALTER TYPE "public"."incident_event_type" ADD VALUE 'OBLIGATION_SUBMITTED';--> statement-breakpoint
CREATE TABLE "controls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"framework" text NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	CONSTRAINT "controls_framework_code_uq" UNIQUE("framework","code")
);
--> statement-breakpoint
CREATE TABLE "incident_controls" (
	"incident_id" uuid NOT NULL,
	"control_id" uuid NOT NULL,
	CONSTRAINT "incident_controls_incident_id_control_id_pk" PRIMARY KEY("incident_id","control_id")
);
--> statement-breakpoint
CREATE TABLE "obligations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"kind" "obligation_kind" NOT NULL,
	"aware_at" timestamp with time zone NOT NULL,
	"decision" "obligation_decision" DEFAULT 'PENDING' NOT NULL,
	"justification" text,
	"decided_by_id" uuid,
	"decided_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"submitted_by_id" uuid,
	"reference" text,
	"delay_reason" text,
	CONSTRAINT "obligations_incident_kind_uq" UNIQUE("incident_id","kind")
);
--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "nis2_significant" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "incident_controls" ADD CONSTRAINT "incident_controls_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_controls" ADD CONSTRAINT "incident_controls_control_id_controls_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."controls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obligations" ADD CONSTRAINT "obligations_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obligations" ADD CONSTRAINT "obligations_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obligations" ADD CONSTRAINT "obligations_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;