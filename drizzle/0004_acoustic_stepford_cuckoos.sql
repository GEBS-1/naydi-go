CREATE TABLE `api_budget` (
	`month` text PRIMARY KEY NOT NULL,
	`committed` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `api_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`month` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`reserved` integer NOT NULL,
	`actual` integer,
	`status` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_api_calls_month` ON `api_calls` (`month`);