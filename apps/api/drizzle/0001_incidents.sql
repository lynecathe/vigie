CREATE TYPE "public"."incident_event_type" AS ENUM('CREATED', 'STATUS_CHANGED', 'SEVERITY_CHANGED', 'ASSIGNED', 'PERSONAL_DATA_CHANGED', 'ALERT_LINKED', 'COMMENT');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('NEW', 'IN_PROGRESS', 'CONTAINED', 'RESOLVED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"rule_id" text,
	"title" text NOT NULL,
	"severity" "severity" NOT NULL,
	"host" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw" jsonb NOT NULL,
	"incident_id" uuid,
	CONSTRAINT "alerts_source_external_id_uq" UNIQUE("source","external_id")
);
--> statement-breakpoint
CREATE TABLE "incident_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"actor_id" uuid,
	"type" "incident_event_type" NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" serial NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"severity" "severity" NOT NULL,
	"status" "incident_status" DEFAULT 'NEW' NOT NULL,
	"personal_data" boolean DEFAULT false NOT NULL,
	"assignee_id" uuid,
	"created_by_id" uuid,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "incidents_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_events" ADD CONSTRAINT "incident_events_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_events" ADD CONSTRAINT "incident_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_incident_idx" ON "alerts" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "incident_events_incident_idx" ON "incident_events" USING btree ("incident_id","created_at");--> statement-breakpoint
CREATE INDEX "incidents_status_idx" ON "incidents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "incidents_assignee_idx" ON "incidents" USING btree ("assignee_id");