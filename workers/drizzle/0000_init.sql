CREATE TABLE `medications` (
	`id` text PRIMARY KEY NOT NULL,
	`uid` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`dosage` text NOT NULL,
	`timings` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`uid`) REFERENCES `users`(`uid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_medications_uid` ON `medications` (`uid`);--> statement-breakpoint
CREATE TABLE `notification_log` (
	`uid` text NOT NULL,
	`date` text NOT NULL,
	`timing` text NOT NULL,
	`window_start` integer NOT NULL,
	`sent_at` text NOT NULL,
	PRIMARY KEY(`uid`, `date`, `timing`, `window_start`)
);
--> statement-breakpoint
CREATE INDEX `idx_notif_sent_at` ON `notification_log` (`sent_at`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`uid` text PRIMARY KEY NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`uid`) REFERENCES `users`(`uid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `records` (
	`uid` text NOT NULL,
	`date` text NOT NULL,
	`medication_id` text NOT NULL,
	`timing` text NOT NULL,
	`status` text NOT NULL,
	`recorded_at` text NOT NULL,
	PRIMARY KEY(`uid`, `date`, `medication_id`, `timing`)
);
--> statement-breakpoint
CREATE INDEX `idx_records_uid_date` ON `records` (`uid`,`date`);--> statement-breakpoint
CREATE TABLE `users` (
	`uid` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`email` text NOT NULL,
	`morning_time` text DEFAULT '07:00' NOT NULL,
	`noon_time` text DEFAULT '12:00' NOT NULL,
	`evening_time` text DEFAULT '18:00' NOT NULL,
	`bedtime_time` text DEFAULT '22:00' NOT NULL,
	`reminder_interval` integer DEFAULT 15 NOT NULL,
	`created_at` text NOT NULL
);
