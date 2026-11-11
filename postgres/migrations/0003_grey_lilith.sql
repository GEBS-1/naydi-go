CREATE TABLE IF NOT EXISTS "listing_drafts" (
	"owner" text PRIMARY KEY NOT NULL,
	"data" text NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listing_drafts" ADD CONSTRAINT "listing_drafts_owner_buyer_accounts_id_fk" FOREIGN KEY ("owner") REFERENCES "buyer_accounts"("id") ON DELETE no action ON UPDATE no action;