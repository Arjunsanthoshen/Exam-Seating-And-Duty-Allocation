-- ============================================================================
-- EXAM SEATING & DUTY ALLOCATION - COMPLETE DATABASE SCHEMA
-- Production compatible with MySQL 8+, MariaDB 10+, Railway MySQL
-- Character Set: utf8mb4, Collation: utf8mb4_unicode_ci
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Users (Authentication credentials for Admin, Teacher, Student)
CREATE TABLE IF NOT EXISTS `Users` (
  `username` VARCHAR(50) NOT NULL,
  `role` VARCHAR(20) DEFAULT NULL,
  `password` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Teacher (Faculty profile & invigilation availability)
CREATE TABLE IF NOT EXISTS `Teacher` (
  `username` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) DEFAULT NULL,
  `availability` VARCHAR(5) DEFAULT 'Yes',
  `department` VARCHAR(100) DEFAULT NULL,
  `phone` VARCHAR(15) DEFAULT NULL,
  `duty_count` INT(11) DEFAULT 5,
  PRIMARY KEY (`username`),
  CONSTRAINT `fk_teacher_users` FOREIGN KEY (`username`) REFERENCES `Users` (`username`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Student (Student registration details)
CREATE TABLE IF NOT EXISTS `Student` (
  `username` VARCHAR(50) NOT NULL,
  `branch` VARCHAR(10) DEFAULT NULL,
  `batch` VARCHAR(5) DEFAULT NULL,
  `roll_no` INT(11) DEFAULT NULL,
  `year_of_join` INT(11) DEFAULT NULL,
  PRIMARY KEY (`username`),
  CONSTRAINT `fk_student_users` FOREIGN KEY (`username`) REFERENCES `Users` (`username`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Student_manage (Batch summaries & cohort tracking)
CREATE TABLE IF NOT EXISTS `Student_manage` (
  `year_of_join` INT(11) DEFAULT NULL,
  `branch` VARCHAR(10) DEFAULT NULL,
  `batch` VARCHAR(5) DEFAULT NULL,
  `end_serial` INT(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. blocks (Campus blocks registry)
CREATE TABLE IF NOT EXISTS `blocks` (
  `block_name` VARCHAR(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Rooms (Examination halls and seating column layout)
CREATE TABLE IF NOT EXISTS `Rooms` (
  `room_no` INT(11) NOT NULL,
  `block` VARCHAR(10) NOT NULL,
  `capacity` INT(11) DEFAULT NULL,
  `cap_per_bench` INT(11) DEFAULT NULL,
  `col1` INT(11) DEFAULT NULL,
  `col2` INT(11) DEFAULT NULL,
  `col3` INT(11) DEFAULT NULL,
  `col4` INT(11) DEFAULT NULL,
  `col5` INT(11) DEFAULT NULL,
  PRIMARY KEY (`room_no`, `block`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Exam_schedule (Exam timetable slots & course subjects)
CREATE TABLE IF NOT EXISTS `Exam_schedule` (
  `exam_id` INT(11) NOT NULL AUTO_INCREMENT,
  `year` INT(11) DEFAULT NULL,
  `exam_number` INT(11) DEFAULT 1,
  `exam_date` DATE DEFAULT NULL,
  `session` VARCHAR(5) DEFAULT NULL,
  `branch` VARCHAR(5) DEFAULT NULL,
  `subject` VARCHAR(40) DEFAULT NULL,
  `sub_code` VARCHAR(10) DEFAULT NULL,
  PRIMARY KEY (`exam_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Duty_allocation (Faculty invigilation assignments)
CREATE TABLE IF NOT EXISTS `Duty_allocation` (
  `duty_id` INT(11) NOT NULL AUTO_INCREMENT,
  `exam_id` INT(11) NOT NULL,
  `room_no` VARCHAR(10) NOT NULL,
  `block` VARCHAR(10) NOT NULL,
  `Tusername` VARCHAR(50) DEFAULT NULL,
  `exam_date` DATE NOT NULL,
  `session` ENUM('FN','AN') DEFAULT 'FN',
  PRIMARY KEY (`duty_id`),
  KEY `idx_duty_exam` (`exam_id`),
  KEY `idx_duty_teacher` (`Tusername`),
  CONSTRAINT `fk_duty_exam` FOREIGN KEY (`exam_id`) REFERENCES `Exam_schedule` (`exam_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_duty_teacher` FOREIGN KEY (`Tusername`) REFERENCES `Teacher` (`username`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Seating_allocation (Student desk assignments)
CREATE TABLE IF NOT EXISTS `Seating_allocation` (
  `seating_id` INT(11) NOT NULL AUTO_INCREMENT,
  `exam_id` INT(11) DEFAULT NULL,
  `room_no` INT(11) DEFAULT NULL,
  `block` VARCHAR(5) DEFAULT NULL,
  `column_no` INT(11) DEFAULT NULL,
  `bench_no` INT(11) DEFAULT NULL,
  `seat_position` VARCHAR(10) DEFAULT NULL,
  `username` VARCHAR(50) DEFAULT NULL,
  `batch` VARCHAR(5) DEFAULT NULL,
  `roll_no` INT(11) DEFAULT NULL,
  `branch` VARCHAR(5) DEFAULT NULL,
  `session` VARCHAR(5) DEFAULT NULL,
  PRIMARY KEY (`seating_id`),
  KEY `idx_seating_exam` (`exam_id`),
  KEY `idx_seating_room` (`room_no`, `block`),
  KEY `idx_seating_student` (`username`),
  CONSTRAINT `fk_seating_exam` FOREIGN KEY (`exam_id`) REFERENCES `Exam_schedule` (`exam_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_seating_room` FOREIGN KEY (`room_no`, `block`) REFERENCES `Rooms` (`room_no`, `block`) ON DELETE CASCADE,
  CONSTRAINT `fk_seating_student` FOREIGN KEY (`username`) REFERENCES `Student` (`username`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Allocation_History (Tracks generated slot state)
CREATE TABLE IF NOT EXISTS `Allocation_History` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `exam_date` DATE DEFAULT NULL,
  `session` VARCHAR(10) DEFAULT NULL,
  `selected_years` TEXT DEFAULT NULL,
  `selected_rooms` TEXT DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_slot` (`exam_date`, `session`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Reports (Generated PDF records)
CREATE TABLE IF NOT EXISTS `Reports` (
  `report_id` INT(11) NOT NULL AUTO_INCREMENT,
  `report_type` VARCHAR(20) DEFAULT NULL,
  `exam_date` DATE DEFAULT NULL,
  `report_name` VARCHAR(50) DEFAULT NULL,
  `generated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `filepath` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`report_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. admin_request_state (Tracking faculty unread request badge)
CREATE TABLE IF NOT EXISTS `admin_request_state` (
  `state_id` INT(11) NOT NULL,
  `last_seen_unavailability_id` INT(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`state_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. teacher_unavailability (Faculty leave & duty exemption requests)
CREATE TABLE IF NOT EXISTS `teacher_unavailability` (
  `unavailability_id` INT(11) NOT NULL AUTO_INCREMENT,
  `Tusername` VARCHAR(255) NOT NULL,
  `exam_date` DATE NOT NULL,
  `session` VARCHAR(20) NOT NULL,
  `reason` TEXT NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`unavailability_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ensure default state for admin request badge
INSERT IGNORE INTO `admin_request_state` (`state_id`, `last_seen_unavailability_id`) VALUES (1, 0);

SET FOREIGN_KEY_CHECKS = 1;
