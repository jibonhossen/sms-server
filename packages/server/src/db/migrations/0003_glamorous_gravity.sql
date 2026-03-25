ALTER TABLE "devices" ADD COLUMN "battery_level" integer;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "battery_charging" boolean;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "app_version" varchar(50);--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "connection_status" boolean;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "failed_messages_hour" integer;