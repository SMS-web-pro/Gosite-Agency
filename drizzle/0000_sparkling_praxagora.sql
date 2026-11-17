CREATE TABLE IF NOT EXISTS "activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_key" text NOT NULL,
	"action" text NOT NULL,
	"message" text NOT NULL,
	"level" text DEFAULT 'info' NOT NULL,
	"prospect_id" integer,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_learnings" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_key" text NOT NULL,
	"insight" text NOT NULL,
	"kind" text DEFAULT 'observation' NOT NULL,
	"confidence" integer DEFAULT 60 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_key" text NOT NULL,
	"title" text NOT NULL,
	"instruction" text NOT NULL,
	"source" text DEFAULT 'user' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agents" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"role_title" text NOT NULL,
	"description" text NOT NULL,
	"icon" text NOT NULL,
	"color" text NOT NULL,
	"status" text DEFAULT 'ready' NOT NULL,
	"is_live" boolean DEFAULT false NOT NULL,
	"auto_pilot" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"stats" jsonb DEFAULT '{"runs":0,"successes":0,"failures":0}'::jsonb NOT NULL,
	"last_run_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agents_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_calls" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_key" text NOT NULL,
	"task" text NOT NULL,
	"ok" boolean DEFAULT true NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "do_not_contact" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"reason" text DEFAULT 'stop' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "do_not_contact_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"prospect_id" integer,
	"to_email" text NOT NULL,
	"subject" text,
	"body_html" text,
	"status" text DEFAULT 'sent' NOT NULL,
	"message_id" text,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"token" text,
	"opened_at" timestamp,
	"opens" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"click_site" integer DEFAULT 0 NOT NULL,
	"click_payment" integer DEFAULT 0 NOT NULL,
	"last_click_at" timestamp,
	"last_click_url" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inbound_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"prospect_id" integer,
	"message_id" text NOT NULL,
	"from_email" text NOT NULL,
	"from_name" text,
	"subject" text,
	"body_text" text NOT NULL,
	"in_reply_to" text,
	"headers" jsonb,
	"status" text DEFAULT 'new' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"prospect_id" integer NOT NULL,
	"author" text DEFAULT 'RIO' NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "login_attempts" (
	"ip" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "objectives" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"metric" text DEFAULT 'paid' NOT NULL,
	"target" integer DEFAULT 10 NOT NULL,
	"due_date" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prospects" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_name" text NOT NULL,
	"business_type" text DEFAULT 'business' NOT NULL,
	"tagline" text,
	"description" text,
	"phone" text,
	"email" text,
	"email_status" text DEFAULT 'unknown' NOT NULL,
	"email_detail" text,
	"address" text,
	"city" text,
	"zip" text,
	"country" text,
	"rating" numeric,
	"review_count" integer,
	"has_website" boolean DEFAULT false NOT NULL,
	"website_url" text,
	"maps_link" text,
	"lat" numeric,
	"lng" numeric,
	"hours" jsonb,
	"source" text DEFAULT 'simulation' NOT NULL,
	"stage" text DEFAULT 'discovered' NOT NULL,
	"reject_reason" text,
	"client_data" jsonb,
	"site_html" text,
	"site_bundle" jsonb,
	"site_slug" text,
	"deployed_url" text,
	"deploy_status" text DEFAULT 'none' NOT NULL,
	"sales_email_id" text,
	"contacted_at" timestamp,
	"payment_url" text,
	"payment_status" text DEFAULT 'none' NOT NULL,
	"domain_url" text,
	"search_query" text,
	"ai_score" integer,
	"ai_insight" text,
	"fail_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rio_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel" text DEFAULT 'web' NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"tool_calls" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scout_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"niche" text NOT NULL,
	"city" text NOT NULL,
	"interval_hours" integer DEFAULT 6 NOT NULL,
	"max_results" integer DEFAULT 12 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "serper_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"api_key" text NOT NULL,
	"credit_limit" integer DEFAULT 2500 NOT NULL,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_provisioned" boolean DEFAULT false NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "serper_keys_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "site_leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"prospect_id" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"ip" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
