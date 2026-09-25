CREATE TABLE `external_places` (
	`id` text PRIMARY KEY NOT NULL,
	`city` text NOT NULL,
	`category` text NOT NULL,
	`data` text NOT NULL,
	`checked_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_external_city_category` ON `external_places` (`city`,`category`);--> statement-breakpoint
CREATE TABLE `search_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_search_cache_expiry` ON `search_cache` (`expires_at`);--> statement-breakpoint
CREATE TABLE `search_locks` (
	`id` text PRIMARY KEY NOT NULL,
	`until_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `search_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL
);
