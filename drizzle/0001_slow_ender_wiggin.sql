CREATE TABLE `onboarding` (
	`store_id` text PRIMARY KEY NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`consent` text,
	`confirmed_at` text,
	FOREIGN KEY (`store_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `owner_invites` (
	`hash` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`email` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	FOREIGN KEY (`store_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_invites_store` ON `owner_invites` (`store_id`);--> statement-breakpoint
CREATE TABLE `preview_tokens` (
	`hash` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_preview_store` ON `preview_tokens` (`store_id`);--> statement-breakpoint
ALTER TABLE `shops` ADD `visibility` text DEFAULT 'public' NOT NULL;