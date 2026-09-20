-- ==============================================================================
-- DEMO MODE DATABASE MIGRATION SCRIPT (FOR RAILWAY MYSQL 8+ / 9+ & PRODUCTION)
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
--
-- Compatibility Note:
-- MySQL (including 8.x and 9.4+) does not support "ADD COLUMN IF NOT EXISTS"
-- in ALTER TABLE statements. This script defines an idempotent helper procedure
-- that checks information_schema before altering, and drops itself upon completion.
-- ==============================================================================

DROP PROCEDURE IF EXISTS `AddColumnIfNotExists`;

DELIMITER //

CREATE PROCEDURE `AddColumnIfNotExists`(
    IN tableName VARCHAR(64),
    IN columnName VARCHAR(64),
    IN columnDefinition TEXT
)
BEGIN
    DECLARE tblExists INT DEFAULT 0;
    DECLARE colExists INT DEFAULT 0;

    SELECT COUNT(*) INTO tblExists
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND LOWER(TABLE_NAME) = LOWER(tableName);

    IF tblExists > 0 THEN
        SELECT COUNT(*) INTO colExists
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND LOWER(TABLE_NAME) = LOWER(tableName)
          AND LOWER(COLUMN_NAME) = LOWER(columnName);

        IF colExists = 0 THEN
            SET @sql = CONCAT('ALTER TABLE `', tableName, '` ADD COLUMN `', columnName, '` ', columnDefinition);
            PREPARE stmt FROM @sql;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;
        END IF;
    END IF;
END //

DELIMITER ;

-- 1. Add status and is_demo to teacher_unavailability
CALL AddColumnIfNotExists('teacher_unavailability', 'status', 'VARCHAR(20) DEFAULT ''Pending Review''');
CALL AddColumnIfNotExists('teacher_unavailability', 'is_demo', 'TINYINT(1) DEFAULT 0');

-- 2. Add is_demo to allocation and schedule tables
CALL AddColumnIfNotExists('Seating_allocation', 'is_demo', 'TINYINT(1) DEFAULT 0');
CALL AddColumnIfNotExists('Allocation_History', 'is_demo', 'TINYINT(1) DEFAULT 0');
CALL AddColumnIfNotExists('Duty_allocation', 'is_demo', 'TINYINT(1) DEFAULT 0');
CALL AddColumnIfNotExists('Reports', 'is_demo', 'TINYINT(1) DEFAULT 0');
CALL AddColumnIfNotExists('Exam_schedule', 'is_demo', 'TINYINT(1) DEFAULT 0');

-- 3. Add is_demo to management and infrastructure tables
CALL AddColumnIfNotExists('Rooms', 'is_demo', 'TINYINT(1) DEFAULT 0');
CALL AddColumnIfNotExists('blocks', 'is_demo', 'TINYINT(1) DEFAULT 0');
CALL AddColumnIfNotExists('Student_manage', 'is_demo', 'TINYINT(1) DEFAULT 0');
CALL AddColumnIfNotExists('Student', 'is_demo', 'TINYINT(1) DEFAULT 0');
CALL AddColumnIfNotExists('Teacher', 'is_demo', 'TINYINT(1) DEFAULT 0');
CALL AddColumnIfNotExists('Users', 'is_demo', 'TINYINT(1) DEFAULT 0');

-- Drop helper procedure after migration
DROP PROCEDURE IF EXISTS `AddColumnIfNotExists`;

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
