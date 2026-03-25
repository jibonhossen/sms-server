ALTER TABLE "messages" DROP CONSTRAINT "messages_sim_card_id_sim_cards_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_sim_card_id_sim_cards_id_fk" FOREIGN KEY ("sim_card_id") REFERENCES "sim_cards"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
