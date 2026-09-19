const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function seed() {
    console.log("Connecting to database...");
    const db = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'tree',
        database: 'college'
    });

    console.log("Connected. Clearing old allocations, schedules, and student data...");
    await db.query("SET FOREIGN_KEY_CHECKS = 0;");
    await db.query("TRUNCATE TABLE Seating_allocation;");
    await db.query("TRUNCATE TABLE Allocation_History;");
    await db.query("TRUNCATE TABLE Duty_allocation;");
    await db.query("TRUNCATE TABLE Exam_schedule;");
    await db.query("TRUNCATE TABLE Student;");
    await db.query("TRUNCATE TABLE Student_manage;");
    await db.query("TRUNCATE TABLE Reports;");
    // Delete students from Users table (keep admin and teachers)
    await db.query("DELETE FROM Users WHERE role = 'student';");
    await db.query("SET FOREIGN_KEY_CHECKS = 1;");

    console.log("Seeding clean student batches for years 2022, 2023, 2024, 2025...");
    const years = [2022, 2023, 2024, 2025];
    const passwordHash = await bcrypt.hash('student123', 10);

    const userRows = [];
    const studentRows = [];
    const manageRows = [];

    // Format roll number zero-padded
    const pad = (n) => String(n).padStart(2, '0');

    for (const yr of years) {
        // Branches configuration:
        // CSE has 3 batches: A, B, C (50 each)
        // ECE, EEE, ME, CE, IT have batch A (50 each)
        const batchConfigs = [
            { branch: 'CSE', batch: 'A', strength: 50 },
            { branch: 'CSE', batch: 'B', strength: 50 },
            { branch: 'CSE', batch: 'C', strength: 50 },
            { branch: 'ECE', batch: 'A', strength: 50 },
            { branch: 'EEE', batch: 'A', strength: 50 },
            { branch: 'ME',  batch: 'A', strength: 50 },
            { branch: 'CE',  batch: 'A', strength: 50 },
            { branch: 'IT',  batch: 'A', strength: 50 },
        ];

        for (const cfg of batchConfigs) {
            manageRows.push([yr, cfg.branch, cfg.batch, cfg.strength]);

            for (let i = 1; i <= cfg.strength; i++) {
                const uname = `${yr}_${cfg.branch}_${cfg.batch}_${pad(i)}`;
                userRows.push([uname, 'student', passwordHash]);
                studentRows.push([uname, cfg.branch, cfg.batch, i, yr]);
            }
        }
    }

    console.log(`Inserting ${manageRows.length} Student_manage batches...`);
    await db.query(
        "INSERT INTO Student_manage (year_of_join, branch, batch, end_serial) VALUES ?",
        [manageRows]
    );

    console.log(`Inserting ${userRows.length} student accounts into Users...`);
    // Chunk insert for Users to keep query sizes reasonable
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < userRows.length; i += CHUNK_SIZE) {
        await db.query(
            "INSERT INTO Users (username, role, password) VALUES ?",
            [userRows.slice(i, i + CHUNK_SIZE)]
        );
    }

    console.log(`Inserting ${studentRows.length} student rows into Student...`);
    for (let i = 0; i < studentRows.length; i += CHUNK_SIZE) {
        await db.query(
            "INSERT INTO Student (username, branch, batch, roll_no, year_of_join) VALUES ?",
            [studentRows.slice(i, i + CHUNK_SIZE)]
        );
    }

    console.log("Seeding 4 exams across 2 dates (Day 1 FN/AN, Day 2 FN/AN)...");
    // Academic Year Mapping (Current Year is 2026):
    // Year 1: 2025 join
    // Year 2: 2024 join
    // Year 3: 2023 join
    // Year 4: 2022 join

    // Date 1: 2026-05-11 (Day 1)
    // - FN: Year 1
    // - AN: Year 2
    // Date 2: 2026-05-12 (Day 2)
    // - FN: Year 3
    // - AN: Year 4

    const examRows = [
        // Day 1 FN - Year 1 (Exam 1)
        [1, 1, '2026-05-11', 'FN', 'CSE', 'Engineering Mathematics I', 'MA101'],
        [1, 1, '2026-05-11', 'FN', 'ECE', 'Engineering Mathematics I', 'MA101'],
        [1, 1, '2026-05-11', 'FN', 'EEE', 'Engineering Mathematics I', 'MA101'],
        [1, 1, '2026-05-11', 'FN', 'ME',  'Engineering Mathematics I', 'MA101'],
        [1, 1, '2026-05-11', 'FN', 'CE',  'Engineering Mathematics I', 'MA101'],
        [1, 1, '2026-05-11', 'FN', 'IT',  'Engineering Mathematics I', 'MA101'],

        // Day 1 AN - Year 2 (Exam 2)
        [2, 2, '2026-05-11', 'AN', 'CSE', 'Data Structures & Algorithms', 'CS201'],
        [2, 2, '2026-05-11', 'AN', 'ECE', 'Signals and Systems', 'EC201'],
        [2, 2, '2026-05-11', 'AN', 'EEE', 'Electrical Machines', 'EE201'],
        [2, 2, '2026-05-11', 'AN', 'ME',  'Thermodynamics', 'ME201'],
        [2, 2, '2026-05-11', 'AN', 'CE',  'Mechanics of Solids', 'CE201'],
        [2, 2, '2026-05-11', 'AN', 'IT',  'Data Structures & Algorithms', 'IT201'],

        // Day 2 FN - Year 3 (Exam 3)
        [3, 1, '2026-05-12', 'FN', 'CSE', 'Operating Systems', 'CS301'],
        [3, 1, '2026-05-12', 'FN', 'ECE', 'Digital Signal Processing', 'EC301'],
        [3, 1, '2026-05-12', 'FN', 'EEE', 'Power Systems', 'EE301'],
        [3, 1, '2026-05-12', 'FN', 'ME',  'Fluid Mechanics', 'ME301'],
        [3, 1, '2026-05-12', 'FN', 'CE',  'Structural Analysis', 'CE301'],
        [3, 1, '2026-05-12', 'FN', 'IT',  'Operating Systems', 'IT301'],

        // Day 2 AN - Year 4 (Exam 4)
        [4, 2, '2026-05-12', 'AN', 'CSE', 'Machine Learning & AI', 'CS401'],
        [4, 2, '2026-05-12', 'AN', 'ECE', 'VLSI Design', 'EC401'],
        [4, 2, '2026-05-12', 'AN', 'EEE', 'Power Electronics', 'EE401'],
        [4, 2, '2026-05-12', 'AN', 'ME',  'Automobile Engineering', 'ME401'],
        [4, 2, '2026-05-12', 'AN', 'CE',  'Design of Concrete Structures', 'CE401'],
        [4, 2, '2026-05-12', 'AN', 'IT',  'Cloud Computing', 'IT401'],
    ];

    await db.query(
        "INSERT INTO Exam_schedule (year, exam_number, exam_date, session, branch, subject, sub_code) VALUES ?",
        [examRows]
    );

    console.log(`Inserted ${examRows.length} exam subject entries for 4 exams across 2 dates.`);
    await db.end();
    console.log("Seeding completed successfully!");
}

seed().catch(err => {
    console.error("Seeding failed:", err);
    process.exit(1);
});
