CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete', 'flag', 'unflag', 'hold', 'release', 'settle', 'void');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_name" varchar(100) NOT NULL,
	"record_id" uuid NOT NULL,
	"action" "audit_action" NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"reason" text,
	"changed_by" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_score_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"period" varchar(50),
	"minute" integer,
	"source" varchar(50) NOT NULL,
	"scraped_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "odds_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"market_type" varchar(50) NOT NULL,
	"outcome_name" varchar(100) NOT NULL,
	"previous_odds" varchar(20),
	"new_odds" varchar(20) NOT NULL,
	"change_percent" varchar(20),
	"source" varchar(50) NOT NULL,
	"is_flagged" integer DEFAULT 0 NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "is_flagged" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "flag_reason" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "flagged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "predictions" ADD COLUMN "is_held" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "predictions" ADD COLUMN "hold_reason" text;--> statement-breakpoint
ALTER TABLE "predictions" ADD COLUMN "held_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "predictions" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "predictions" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_score_history" ADD CONSTRAINT "event_score_history_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odds_history" ADD CONSTRAINT "odds_history_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_table_record_idx" ON "audit_log" USING btree ("table_name","record_id");--> statement-breakpoint
CREATE INDEX "audit_log_changed_at_idx" ON "audit_log" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_log_changed_by_idx" ON "audit_log" USING btree ("changed_by");--> statement-breakpoint
CREATE INDEX "event_score_history_event_id_idx" ON "event_score_history" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_score_history_scraped_at_idx" ON "event_score_history" USING btree ("scraped_at");--> statement-breakpoint
CREATE INDEX "odds_history_event_id_idx" ON "odds_history" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "odds_history_recorded_at_idx" ON "odds_history" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "odds_history_flagged_idx" ON "odds_history" USING btree ("is_flagged");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "events_external_flashscore_unique" ON "events" USING btree ("external_flashscore_id");--> statement-breakpoint
CREATE INDEX "events_flagged_idx" ON "events" USING btree ("is_flagged");--> statement-breakpoint
CREATE INDEX "predictions_held_idx" ON "predictions" USING btree ("is_held");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_scores_positive" CHECK ((home_score IS NULL OR home_score >= 0) AND (away_score IS NULL OR away_score >= 0));