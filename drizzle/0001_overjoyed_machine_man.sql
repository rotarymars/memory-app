ALTER TABLE "cards" ADD COLUMN "user_id" text;--> statement-breakpoint
UPDATE "cards" SET "user_id" = '__orphan__' WHERE "user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "cards" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "cards_user_id_idx" ON "cards" USING btree ("user_id");
