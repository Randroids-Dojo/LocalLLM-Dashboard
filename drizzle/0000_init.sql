CREATE TYPE "public"."run_status" AS ENUM('published', 'flagged', 'revoked');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"machine_id" text,
	"reason" text,
	"prev_status" "run_status",
	"new_status" "run_status",
	"actor_ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "machines" (
	"machine_id" text PRIMARY KEY NOT NULL,
	"chip" text NOT NULL,
	"chip_family" text NOT NULL,
	"cpu_cores" integer,
	"memory_gb" integer,
	"memory_tier" text NOT NULL,
	"model_identifier" text,
	"model_name" text,
	"hardware_class" text NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"submission_count" integer DEFAULT 0 NOT NULL,
	"run_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"machine_id" text NOT NULL,
	"run_name" text NOT NULL,
	"task" text NOT NULL,
	"category" text NOT NULL,
	"language" text,
	"prompt_variant" text DEFAULT 'default',
	"model" text NOT NULL,
	"model_parameters" text,
	"model_quant" text,
	"verdict" text NOT NULL,
	"outcome" text NOT NULL,
	"pass" boolean NOT NULL,
	"tests_passed" integer,
	"tests_total" integer,
	"agent_seconds" integer,
	"grade_seconds" integer,
	"duration_seconds" integer,
	"timeout_seconds" integer,
	"turns" integer,
	"commands" integer,
	"tokens_in" integer,
	"tokens_out" integer,
	"tokens_per_sec" real,
	"agent_changed_files" integer,
	"integrity_ok" boolean,
	"repeat_index" integer,
	"run_timestamp" timestamp with time zone,
	"suite_run_id" text,
	"status" "run_status" DEFAULT 'published' NOT NULL,
	"flag_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"server_recomputed_pass" boolean,
	"claimed_pass" boolean,
	"artifact_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"machine_id" text NOT NULL,
	"suite_run_id" text,
	"harness_version" text,
	"handle" text,
	"ip_hash" text NOT NULL,
	"idempotency_key" text,
	"run_row_count" integer NOT NULL,
	"accepted_count" integer NOT NULL,
	"status" "run_status" DEFAULT 'published' NOT NULL,
	"flag_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"signature_valid" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_machine_id_machines_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("machine_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_machine_id_machines_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("machine_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "machines_hw_class_idx" ON "machines" USING btree ("hardware_class");--> statement-breakpoint
CREATE INDEX "machines_chip_family_idx" ON "machines" USING btree ("chip_family","memory_tier");--> statement-breakpoint
CREATE UNIQUE INDEX "runs_run_name_idx" ON "runs" USING btree ("run_name");--> statement-breakpoint
CREATE INDEX "runs_model_idx" ON "runs" USING btree ("model");--> statement-breakpoint
CREATE INDEX "runs_category_idx" ON "runs" USING btree ("category");--> statement-breakpoint
CREATE INDEX "runs_machine_model_idx" ON "runs" USING btree ("machine_id","model","status");--> statement-breakpoint
CREATE INDEX "runs_leaderboard_idx" ON "runs" USING btree ("machine_id","status","model","category");--> statement-breakpoint
CREATE INDEX "runs_status_idx" ON "runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "submissions_machine_idx" ON "submissions" USING btree ("machine_id");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_idem_idx" ON "submissions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "submissions_submitted_idx" ON "submissions" USING btree ("submitted_at");