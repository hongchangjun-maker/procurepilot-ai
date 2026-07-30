CREATE TABLE `agencies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`region_sido` text DEFAULT '전국' NOT NULL,
	`region_sigungu` text DEFAULT '' NOT NULL,
	`homepage_url` text DEFAULT '' NOT NULL,
	`source_type` text DEFAULT 'api' NOT NULL,
	`source_config` text DEFAULT '{}' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_analyses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`opportunity_id` integer NOT NULL,
	`summary_json` text NOT NULL,
	`relevance_score` real DEFAULT 0 NOT NULL,
	`relevance_grade` text DEFAULT '' NOT NULL,
	`relevance_reason` text DEFAULT '' NOT NULL,
	`strengths` text DEFAULT '[]' NOT NULL,
	`weaknesses` text DEFAULT '[]' NOT NULL,
	`strategy` text DEFAULT '' NOT NULL,
	`model_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_analyses_opportunity_idx` ON `ai_analyses` (`opportunity_id`);--> statement-breakpoint
CREATE TABLE `app_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_settings_key_unique` ON `app_settings` (`key`);--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`opportunity_id` integer NOT NULL,
	`file_name` text NOT NULL,
	`file_url` text NOT NULL,
	`file_type` text DEFAULT '' NOT NULL,
	`file_size` integer DEFAULT 0 NOT NULL,
	`extracted_text` text DEFAULT '' NOT NULL,
	`storage_key` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `business_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_name` text NOT NULL,
	`intro` text DEFAULT '' NOT NULL,
	`technologies` text DEFAULT '' NOT NULL,
	`services` text DEFAULT '' NOT NULL,
	`achievements` text DEFAULT '' NOT NULL,
	`strengths` text DEFAULT '' NOT NULL,
	`target_markets` text DEFAULT '' NOT NULL,
	`preferred_categories` text DEFAULT '' NOT NULL,
	`excluded_categories` text DEFAULT '' NOT NULL,
	`budget_range` text DEFAULT '' NOT NULL,
	`service_regions` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `collection_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_name` text NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`total_count` integer DEFAULT 0 NOT NULL,
	`new_count` integer DEFAULT 0 NOT NULL,
	`updated_count` integer DEFAULT 0 NOT NULL,
	`error_message` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `opportunities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_name` text NOT NULL,
	`source_notice_id` text NOT NULL,
	`title` text NOT NULL,
	`agency_name` text NOT NULL,
	`region_sido` text DEFAULT '전국' NOT NULL,
	`region_sigungu` text DEFAULT '' NOT NULL,
	`category` text DEFAULT '기타' NOT NULL,
	`notice_type` text DEFAULT '입찰공고' NOT NULL,
	`published_at` text NOT NULL,
	`deadline_at` text DEFAULT '' NOT NULL,
	`budget` integer DEFAULT 0 NOT NULL,
	`summary_raw` text DEFAULT '' NOT NULL,
	`detail_text` text DEFAULT '' NOT NULL,
	`original_url` text NOT NULL,
	`status` text DEFAULT '진행중' NOT NULL,
	`duplicate_key` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `opportunities_duplicate_key_idx` ON `opportunities` (`duplicate_key`);--> statement-breakpoint
CREATE INDEX `opportunities_deadline_idx` ON `opportunities` (`deadline_at`);--> statement-breakpoint
CREATE INDEX `opportunities_agency_idx` ON `opportunities` (`agency_name`);--> statement-breakpoint
CREATE TABLE `user_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`opportunity_id` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`is_favorite` integer DEFAULT false NOT NULL,
	`tags` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_notes_opportunity_idx` ON `user_notes` (`opportunity_id`);