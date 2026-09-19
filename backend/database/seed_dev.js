const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

// Load environment variables
try {
    const dotenv = require('dotenv');
    dotenv.config({ path: path.join(__dirname, '..', '.env') });
} catch (e) {}

function getDbConfig() {
    const connectionUri = process.env.MYSQL_URL || process.env.DATABASE_URL;
    if (connectionUri) {
        try {
            const url = new URL(connectionUri);
            return {
                host: url.hostname,
                port: Number(url.port) || 3306,
                user: decodeURIComponent(url.username),
                password: decodeURIComponent(url.password),
                database: url.pathname.replace(/^\//, ''),
                multipleStatements: true,
                ssl: process.env.DB_SSL === 'false' ? undefined : (process.env.DB_SSL === 'true' || url.searchParams.get('ssl') ? { rejectUnauthorized: false } : undefined)
            };
        } catch (e) {
            return { uri: connectionUri, multipleStatements: true };
        }
    }

    return {
        host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
        port: Number(process.env.MYSQLPORT || process.env.DB_PORT) || 3306,
        user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
        password: process.env.MYSQLPASSWORD !== undefined
            ? process.env.MYSQLPASSWORD
            : (process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : (process.env.NODE_ENV === 'production' ? '' : 'tree')),
        database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'college',
        multipleStatements: true,
        ssl: (process.env.DB_SSL === 'true' || process.env.MYSQL_SSL === 'true') ? { rejectUnauthorized: false } : undefined
    };
}

async function seed() {
    console.log('====================================================');
    console.log(' DEVELOPMENT SEED SCRIPT (Local Testing Only)');
    console.log('====================================================');

    if (process.env.NODE_ENV === 'production' && !process.env.FORCE_DEV_SEED) {
        console.error('ERROR: Development seed script is not permitted in production without FORCE_DEV_SEED=true.');
        process.exit(1);
    }

    const config = getDbConfig();
    const db = await mysql.createConnection(config);

    try {
        console.log('Connected. Clearing dev allocations, schedules, and student data...');
        await db.query('SET FOREIGN_KEY_CHECKS = 0;');
        await db.query('TRUNCATE TABLE Seating_allocation;');
        await db.query('TRUNCATE TABLE Allocation_History;');
        await db.query('TRUNCATE TABLE Duty_allocation;');
        await db.query('TRUNCATE TABLE Exam_schedule;');
        await db.query('TRUNCATE TABLE Student;');
        await db.query('TRUNCATE TABLE Student_manage;');
        await db.query('TRUNCATE TABLE Reports;');
        await db.query("DELETE FROM Users WHERE role = 'student';");
        await db.query('SET FOREIGN_KEY_CHECKS = 1;');

        console.log('Seeding campus blocks and rooms...');
        const blocks = ['MTB', 'SFB', 'SJPB'];
        for (const b of blocks) {
            await db.query('INSERT IGNORE INTO blocks (block_name) VALUES (?)', [b]);
        }

        const roomConfigs = [
            [101, 'MTB', 40, 2, 4, 4, 4, 4, 4],
            [102, 'MTB', 40, 2, 4, 4, 4, 4, 4],
            [107, 'MTB', 40, 2, 4, 4, 4, 4, 4],
            [401, 'SFB', 40, 2, 4, 4, 4, 4, 4],
            [402, 'SFB', 40, 2, 4, 4, 4, 4, 4],
            [407, 'SFB', 40, 2, 4, 4, 4, 4, 4],
            [301, 'SJPB', 40, 2, 4, 4, 4, 4, 4],
            [302, 'SJPB', 40, 2, 4, 4, 4, 4, 4]
        ];

        for (const r of roomConfigs) {
            await db.query(
                `INSERT INTO Rooms (room_no, block, capacity, cap_per_bench, col1, col2, col3, col4, col5)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE capacity=VALUES(capacity), cap_per_bench=VALUES(cap_per_bench)`,
                r
            );
        }

        console.log('Seeding student cohorts for years 2022, 2023, 2024, 2025...');
        const years = [2022, 2023, 2024, 2025];
        const studentPasswordHash = await bcrypt.hash('student123', 10);

        const userRows = [];
        const studentRows = [];
        const manageRows = [];
        const pad = (n) => String(n).padStart(2, '0');

        for (const yr of years) {
            const batchConfigs = [
                { branch: 'CSE', batch: 'A', strength: 50 },
                { branch: 'CSE', batch: 'B', strength: 50 },
                { branch: 'CSE', batch: 'C', strength: 50 },
                { branch: 'ECE', batch: 'A', strength: 50 },
                { branch: 'EEE', batch: 'A', strength: 50 },
                { branch: 'ME',  batch: 'A', strength: 50 },
                { branch: 'CE',  batch: 'A', strength: 50 },
                { branch: 'IT',  batch: 'A', strength: 50 }
            ];

            for (const cfg of batchConfigs) {
                manageRows.push([yr, cfg.branch, cfg.batch, cfg.strength]);

                for (let i = 1; i <= cfg.strength; i++) {
                    const uname = `${yr}_${cfg.branch}_${cfg.batch}_${pad(i)}`;
                    userRows.push([uname, 'student', studentPasswordHash]);
                    studentRows.push([uname, cfg.branch, cfg.batch, i, yr]);
                }
            }
        }

        await db.query(
            'INSERT INTO Student_manage (year_of_join, branch, batch, end_serial) VALUES ?',
            [manageRows]
        );

        const CHUNK_SIZE = 1000;
        for (let i = 0; i < userRows.length; i += CHUNK_SIZE) {
            await db.query(
                'INSERT INTO Users (username, role, password) VALUES ?',
                [userRows.slice(i, i + CHUNK_SIZE)]
            );
        }

        for (let i = 0; i < studentRows.length; i += CHUNK_SIZE) {
            await db.query(
                'INSERT INTO Student (username, branch, batch, roll_no, year_of_join) VALUES ?',
                [studentRows.slice(i, i + CHUNK_SIZE)]
            );
        }

        console.log('Seeding exam schedule slots...');
        const examRows = [
            [1, 1, '2026-05-11', 'FN', 'CSE', 'Engineering Mathematics I', 'MA101'],
            [1, 1, '2026-05-11', 'FN', 'ECE', 'Engineering Mathematics I', 'MA101'],
            [1, 1, '2026-05-11', 'FN', 'EEE', 'Engineering Mathematics I', 'MA101'],
            [1, 1, '2026-05-11', 'FN', 'ME',  'Engineering Mathematics I', 'MA101'],
            [1, 1, '2026-05-11', 'FN', 'CE',  'Engineering Mathematics I', 'MA101'],
            [1, 1, '2026-05-11', 'FN', 'IT',  'Engineering Mathematics I', 'MA101'],

            [2, 2, '2026-05-11', 'AN', 'CSE', 'Data Structures & Algorithms', 'CS201'],
            [2, 2, '2026-05-11', 'AN', 'ECE', 'Signals and Systems', 'EC201'],
            [2, 2, '2026-05-11', 'AN', 'EEE', 'Electrical Machines', 'EE201'],
            [2, 2, '2026-05-11', 'AN', 'ME',  'Thermodynamics', 'ME201'],
            [2, 2, '2026-05-11', 'AN', 'CE',  'Mechanics of Solids', 'CE201'],
            [2, 2, '2026-05-11', 'AN', 'IT',  'Data Structures & Algorithms', 'IT201'],

            [3, 1, '2026-05-12', 'FN', 'CSE', 'Operating Systems', 'CS301'],
            [3, 1, '2026-05-12', 'FN', 'ECE', 'Digital Signal Processing', 'EC301'],
            [3, 1, '2026-05-12', 'FN', 'EEE', 'Power Systems', 'EE301'],
            [3, 1, '2026-05-12', 'FN', 'ME',  'Fluid Mechanics', 'ME301'],
            [3, 1, '2026-05-12', 'FN', 'CE',  'Structural Analysis', 'CE301'],
            [3, 1, '2026-05-12', 'FN', 'IT',  'Operating Systems', 'IT301'],

            [4, 2, '2026-05-12', 'AN', 'CSE', 'Machine Learning & AI', 'CS401'],
            [4, 2, '2026-05-12', 'AN', 'ECE', 'VLSI Design', 'EC401'],
            [4, 2, '2026-05-12', 'AN', 'EEE', 'Power Electronics', 'EE401'],
            [4, 2, '2026-05-12', 'AN', 'ME',  'Automobile Engineering', 'ME401'],
            [4, 2, '2026-05-12', 'AN', 'CE',  'Design of Concrete Structures', 'CE401'],
            [4, 2, '2026-05-12', 'AN', 'IT',  'Cloud Computing', 'IT401']
        ];

        await db.query(
            'INSERT INTO Exam_schedule (year, exam_number, exam_date, session, branch, subject, sub_code) VALUES ?',
            [examRows]
        );

        console.log('Development seeding completed successfully!');
    } catch (err) {
        console.error('Seeding failed:', err);
        process.exit(1);
    } finally {
        await db.end();
    }
}

seed();
