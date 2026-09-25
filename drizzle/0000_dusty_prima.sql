CREATE TABLE `claims` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`applicant` text NOT NULL,
	`status` text NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_claims_applicant` ON `claims` (`applicant`);--> statement-breakpoint
CREATE TABLE `favorites` (
	`customer` text NOT NULL,
	`product_id` text NOT NULL,
	PRIMARY KEY(`customer`, `product_id`)
);
--> statement-breakpoint
CREATE TABLE `inquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`customer` text NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_inquiries_customer` ON `inquiries` (`customer`);--> statement-breakpoint
CREATE INDEX `idx_inquiries_store` ON `inquiries` (`store_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`published` integer NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_products_store` ON `products` (`store_id`);--> statement-breakpoint
CREATE INDEX `idx_products_published` ON `products` (`published`);--> statement-breakpoint
CREATE TABLE `searches` (
	`id` text PRIMARY KEY NOT NULL,
	`query` text NOT NULL,
	`result_count` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shops` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_shops_owner` ON `shops` (`owner`);--> statement-breakpoint
CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`mime` text NOT NULL
);
