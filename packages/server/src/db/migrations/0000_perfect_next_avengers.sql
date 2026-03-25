CREATE TABLE IF NOT EXISTS "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" varchar(255) NOT NULL,
	"name" varchar(255),
	"username" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'offline' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp,
	"last_ping_at" timestamp,
	"total_sent" integer DEFAULT 0 NOT NULL,
	"total_failed" integer DEFAULT 0 NOT NULL,
	"priority" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "devices_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" varchar(255),
	"phone_numbers" text[] NOT NULL,
	"text_content" text NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 5 NOT NULL,
	"device_id" varchar(255),
	"sim_card_id" uuid,
	"sim_number" integer,
	"sms_gate_message_id" varchar(255),
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"error_message" text,
	"failed_reason" varchar(100),
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"failed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sim_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"sim_number" integer NOT NULL,
	"phone_number" varchar(50),
	"name" varchar(255),
	"total_sms_limit" integer DEFAULT 0 NOT NULL,
	"sms_used" integer DEFAULT 0 NOT NULL,
	"sms_remaining" integer DEFAULT 0 NOT NULL,
	"daily_sms_limit" integer DEFAULT 100 NOT NULL,
	"daily_sms_sent" integer DEFAULT 0 NOT NULL,
	"daily_reset_at" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"status" varchar(50) DEFAULT 'unknown' NOT NULL,
	"total_sent" integer DEFAULT 0 NOT NULL,
	"total_delivered" integer DEFAULT 0 NOT NULL,
	"total_failed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sim_usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sim_card_id" uuid NOT NULL,
	"date" date NOT NULL,
	"sms_sent" integer DEFAULT 0 NOT NULL,
	"sms_delivered" integer DEFAULT 0 NOT NULL,
	"sms_failed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" varchar(255),
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_device_sim" ON "sim_cards" ("device_id","sim_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_sim_date" ON "sim_usage_logs" ("sim_card_id","date");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_sim_card_id_sim_cards_id_fk" FOREIGN KEY ("sim_card_id") REFERENCES "sim_cards"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sim_cards" ADD CONSTRAINT "sim_cards_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sim_usage_logs" ADD CONSTRAINT "sim_usage_logs_sim_card_id_sim_cards_id_fk" FOREIGN KEY ("sim_card_id") REFERENCES "sim_cards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
