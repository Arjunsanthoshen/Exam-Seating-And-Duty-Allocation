-- ==============================================================================
-- DEMO MODE DATABASE MIGRATION SCRIPT (FOR RAILWAY MYSQL / PRODUCTION)
-- ==============================================================================
-- Run this script explicitly against your Railway MySQL database when you are
-- ready to enable demo-created data tracking.
--
-- DO NOT RUN THIS SCRIPT AUTOMATICALLY.
--
-- This script:
-- 1. Adds the `is_demo` tracking column to allow demo-created data to be safely
--    identified, isolated, and purged without touching real records.
--    Existing records are never retroactively marked as is_demo = 1. After the manual
--    Railway migration, pre-existing records retain the migration default is_demo = 0.
-- 2. Adds the `status` column to `teacher_unavailability` for tracking request approval.
-- ==============================================================================

-- 1. Add status and is_demo to teacher_unavailability
ALTER TABLE `teacher_unavailability`
  ADD COLUMN IF NOT EXISTS `status` VARCHAR(20) DEFAULT 'Pending Review',
  ADD COLUMN IF NOT EXISTS `is_demo` TINYINT(1) DEFAULT 0;

-- 2. Add is_demo to allocation and schedule tables
ALTER TABLE `Seating_allocation`
  ADD COLUMN IF NOT EXISTS `is_demo` TINYINT(1) DEFAULT 0;

ALTER TABLE `Allocation_History`
  ADD COLUMN IF NOT EXISTS `is_demo` TINYINT(1) DEFAULT 0;

ALTER TABLE `Duty_allocation`
  ADD COLUMN IF NOT EXISTS `is_demo` TINYINT(1) DEFAULT 0;

ALTER TABLE `Reports`
  ADD COLUMN IF NOT EXISTS `is_demo` TINYINT(1) DEFAULT 0;

ALTER TABLE `Exam_schedule`
  ADD COLUMN IF NOT EXISTS `is_demo` TINYINT(1) DEFAULT 0;

-- 3. Add is_demo to management and infrastructure tables
ALTER TABLE `Rooms`
  ADD COLUMN IF NOT EXISTS `is_demo` TINYINT(1) DEFAULT 0;

ALTER TABLE `blocks`
  ADD COLUMN IF NOT EXISTS `is_demo` TINYINT(1) DEFAULT 0;

ALTER TABLE `Student_manage`
  ADD COLUMN IF NOT EXISTS `is_demo` TINYINT(1) DEFAULT 0;

ALTER TABLE `Student`
  ADD COLUMN IF NOT EXISTS `is_demo` TINYINT(1) DEFAULT 0;

ALTER TABLE `Teacher`
  ADD COLUMN IF NOT EXISTS `is_demo` TINYINT(1) DEFAULT 0;

ALTER TABLE `Users`
  ADD COLUMN IF NOT EXISTS `is_demo` TINYINT(1) DEFAULT 0;

-- ==============================================================================
-- OPTIONAL: Create Demo Login Accounts
-- Uncomment and execute the block below if you wish to create the demo accounts
-- via SQL directly on Railway. Alternatively, you may create them through the
-- application UI.
-- ==============================================================================
--
-- For bcrypt hash of 'demo' ($2b$10$kBZsgaCYd.bbug1DQ36m9.DpqIGn4hJ5QDBqEhOj99qk2Sxij2yxe):
--
-- INSERT INTO `Users` (`username`, `role`, `password`, `is_demo`)
-- VALUES ('demo', 'admin', '$2b$10$kBZsgaCYd.bbug1DQ36m9.DpqIGn4hJ5QDBqEhOj99qk2Sxij2yxe', 0)
-- ON DUPLICATE KEY UPDATE `password` = VALUES(`password`);
--
-- ==============================================================================
