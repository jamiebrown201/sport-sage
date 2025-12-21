CREATE TYPE "public"."scraper_job_status" AS ENUM('running', 'success', 'failed', 'partial');--> statement-breakpoint
CREATE TYPE "public"."scraper_job_type" AS ENUM('sync_fixtures', 'sync_odds', 'sync_live_scores', 'sync_results', 'settlement');--> statement-breakpoint
CREATE TYPE "public"."scraper_source" AS ENUM('flashscore', 'oddschecker', 'sofascore', 'betexplorer', 'espn', '365scores', 'oddsportal', 'multi');--> statement-breakpoint
CREATE TABLE "data_quality_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric_type" varchar(50) NOT NULL,
	"sport_slug" varchar(50),
	"value" integer NOT NULL,
	"threshold" integer,
	"is_healthy" integer DEFAULT 1 NOT NULL,
	"measured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "scraper_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid,
	"alert_type" varchar(50) NOT NULL,
	"severity" varchar(20) DEFAULT 'warning' NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "scraper_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_type" "scraper_job_type" NOT NULL,
	"source" "scraper_source" NOT NULL,
	"status" "scraper_job_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	"items_processed" integer DEFAULT 0,
	"items_created" integer DEFAULT 0,
	"items_updated" integer DEFAULT 0,
	"items_failed" integer DEFAULT 0,
	"sport_stats" jsonb,
	"error_message" text,
	"error_stack" text,
	"lambda_request_id" varchar(100),
	"lambda_memory_used_mb" integer
);
--> statement-breakpoint
ALTER TABLE "scraper_alerts" ADD CONSTRAINT "scraper_alerts_run_id_scraper_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."scraper_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "data_quality_metric_type_idx" ON "data_quality_metrics" USING btree ("metric_type");--> statement-breakpoint
CREATE INDEX "data_quality_measured_at_idx" ON "data_quality_metrics" USING btree ("measured_at");--> statement-breakpoint
CREATE INDEX "scraper_alerts_type_idx" ON "scraper_alerts" USING btree ("alert_type");--> statement-breakpoint
CREATE INDEX "scraper_alerts_severity_idx" ON "scraper_alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "scraper_alerts_created_at_idx" ON "scraper_alerts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "scraper_runs_job_type_idx" ON "scraper_runs" USING btree ("job_type");--> statement-breakpoint
CREATE INDEX "scraper_runs_status_idx" ON "scraper_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scraper_runs_started_at_idx" ON "scraper_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "scraper_runs_source_idx" ON "scraper_runs" USING btree ("source");