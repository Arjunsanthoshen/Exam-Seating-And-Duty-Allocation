const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

// Load environment variables (.env in backend or project root)
try {
    const dotenv = require("dotenv");
    if (fs.existsSync(path.join(__dirname, ".env"))) {
        dotenv.config({ path: path.join(__dirname, ".env") });
    } else if (fs.existsSync(path.join(__dirname, "..", ".env"))) {
        dotenv.config({ path: path.join(__dirname, "..", ".env") });
    } else {
        dotenv.config();
    }
} catch (envError) {
    if (typeof process.loadEnvFile === "function") {
        try { process.loadEnvFile(); } catch (e) {}
    }
}

const isProduction = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT) || 5000;

// Enforce JWT secret in production
const SECRET_KEY = process.env.JWT_SECRET || (isProduction ? null : "super_secure_college_exam_management_jwt_secret_2026_key");
if (!SECRET_KEY) {
    console.error("FATAL: JWT_SECRET environment variable must be set in production mode.");
    process.exit(1);
}

const BCRYPT_HASH_PREFIX = /^\$2[aby]\$\d{2}\$/;

const BRANCH_MAP = {
    "CS": "CSE",
    "CSE": "CSE",
    "EC": "ECE",
    "ECE": "ECE",
    "EE": "EEE",
    "EEE": "EEE",
    "ME": "ME",
    "CE": "CE",
    "IT": "IT",
    "AD": "AI",
    "AI": "AI",
    "CY": "CY"
};

function canonicalBranch(b) {
    if (!b) return "";
    const upper = String(b).trim().toUpperCase();
    return BRANCH_MAP[upper] || upper;
}

const app = express();

/* -------------------------------------------------------------------------- */
/* SECURITY HEADERS & MIDDLEWARE                                              */
/* -------------------------------------------------------------------------- */

app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
});

// Configure CORS for production (Render frontend URL) and local development
const configuredOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

const defaultAllowedOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173"
];

const allowedOrigins = [...new Set([...configuredOrigins, ...defaultAllowedOrigins])];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
            allowedOrigins.includes(origin) ||
            origin.startsWith("http://localhost:") ||
            origin.startsWith("http://127.0.0.1:") ||
            (!isProduction && origin.includes("localhost"))
        ) {
            return callback(null, true);
        }
        return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

/* -------------------------------------------------------------------------- */
/* AUTHENTICATION RATE LIMITING                                               */
/* -------------------------------------------------------------------------- */

const authRateLimits = new Map();
function authRateLimiter(req, res, next) {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxAttempts = 30;

    let record = authRateLimits.get(ip);
    if (!record || now - record.startTime > windowMs) {
        record = { count: 1, startTime: now };
        authRateLimits.set(ip, record);
        return next();
    }

    record.count++;
    if (record.count > maxAttempts) {
        return res.status(429).json({
            message: "Too many authentication attempts. Please try again after 15 minutes."
        });
    }

    next();
}

/* -------------------------------------------------------------------------- */
/* FILE UPLOAD & DIRECTORY SETUP                                              */
/* -------------------------------------------------------------------------- */

const uploadDir = path.join(__dirname, "uploads_files");
if (fs.existsSync(uploadDir) && !fs.statSync(uploadDir).isDirectory()) {
    fs.unlinkSync(uploadDir);
}
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const safeExt = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}${safeExt}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (![".xlsx", ".xls"].includes(ext)) {
            return cb(new Error("Only Excel spreadsheets (.xlsx, .xls) are allowed"));
        }
        cb(null, true);
    }
});

const generatedReportsDir = path.join(__dirname, "generated_reports");
if (!fs.existsSync(generatedReportsDir)) {
    fs.mkdirSync(generatedReportsDir, { recursive: true });
}

/* -------------------------------------------------------------------------- */
/* DATABASE CONNECTION (Supports Railway MySQL & Local Development)           */
/* -------------------------------------------------------------------------- */

function getDatabasePoolConfig() {
    // 1. Support Railway full connection URI (MYSQL_URL or DATABASE_URL)
    const connectionUri = process.env.MYSQL_URL || process.env.DATABASE_URL;
    if (connectionUri) {
        try {
            const url = new URL(connectionUri);
            const poolConfig = {
                host: url.hostname,
                port: Number(url.port) || 3306,
                user: decodeURIComponent(url.username),
                password: decodeURIComponent(url.password),
                database: url.pathname.replace(/^\//, ""),
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            };
            if (process.env.DB_SSL === "true" || process.env.MYSQL_SSL === "true" || url.searchParams.get("ssl")) {
                poolConfig.ssl = { rejectUnauthorized: false };
            }
            return poolConfig;
        } catch (urlParseErr) {
            return {
                uri: connectionUri,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            };
        }
    }

    // 2. Support Railway individual variables and standard variables
    const host = process.env.MYSQLHOST || process.env.DB_HOST || "localhost";
    const port = Number(process.env.MYSQLPORT || process.env.DB_PORT) || 3306;
    const user = process.env.MYSQLUSER || process.env.DB_USER || "root";
    const password = process.env.MYSQLPASSWORD !== undefined
        ? process.env.MYSQLPASSWORD
        : (process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : (isProduction ? "" : "tree"));
    const database = process.env.MYSQLDATABASE || process.env.DB_NAME || "college";

    const poolConfig = {
        host,
        port,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    };

    if (process.env.DB_SSL === "true" || process.env.MYSQL_SSL === "true") {
        poolConfig.ssl = { rejectUnauthorized: false };
    }

    return poolConfig;
}

const db = mysql.createPool(getDatabasePoolConfig());

// Verify database connection on startup
db.getConnection((err, connection) => {
    if (err) {
        console.error("Database connection error:", err.message);
    } else {
        console.log("Connected to MySQL database pool successfully!");
        connection.release();
    }
});

/* -------------------------------------------------------------------------- */
/* HEALTH CHECK ENDPOINT                                                      */
/* -------------------------------------------------------------------------- */

app.get("/api/health", async (req, res) => {
    try {
        await db.promise().query("SELECT 1");
        res.json({
            status: "ok",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: "connected",
            environment: process.env.NODE_ENV || "development"
        });
    } catch (dbError) {
        res.status(503).json({
            status: "degraded",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: "disconnected",
            error: isProduction ? "Database connection error" : dbError.message
        });
    }
});

const recentDutyAssignments = new Map();

function getDutySlotKey(date, session) {
    return `${date}_${session}`;
}

function formatStudentUsername(year, branch, batch, rollNo, maxStrength = 0) {
    const padLength = Number(maxStrength) >= 100 ? 3 : 2;
    const paddedRoll = String(rollNo).padStart(padLength, '0');
    return `${year}_${branch}_${batch}_${paddedRoll}`;
}

function safeFormatDate(dateInput) {
    if (!dateInput) return null;
    if (typeof dateInput === "string") {
        const trimmed = dateInput.trim();
        const strMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (strMatch) {
            const y = parseInt(strMatch[1], 10);
            const m = parseInt(strMatch[2], 10);
            const d = parseInt(strMatch[3], 10);
            if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
                return `${strMatch[1]}-${strMatch[2]}-${strMatch[3]}`;
            }
        }
    }
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return null;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/* -------------------------------------------------------------------------- */
/* AUTHENTICATION & RBAC MIDDLEWARE                                           */
/* -------------------------------------------------------------------------- */

function requireAuth(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "Authentication required. Please log in." });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(401).json({ message: "Invalid or expired session token." });
        }
        req.user = user;
        next();
    });
}

function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: "Authentication required." });
        }
        const userRole = String(req.user.role || "").trim().toLowerCase();
        const normalizedAllowed = allowedRoles.map(r => r.trim().toLowerCase());

        if (!normalizedAllowed.includes(userRole)) {
            return res.status(403).json({
                message: `Forbidden: Access requires role '${allowedRoles.join(" or ")}'. Your role is '${req.user.role}'.`
            });
        }
        next();
    };
}


async function ensureRequestTables() {
    await db.promise().query(`
        CREATE TABLE IF NOT EXISTS teacher_unavailability (
            unavailability_id INT NOT NULL AUTO_INCREMENT,
            Tusername VARCHAR(255) NOT NULL,
            exam_date DATE NOT NULL,
            session VARCHAR(20) NOT NULL,
            reason TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (unavailability_id)
        )
    `);

    await db.promise().query(`
        ALTER TABLE teacher_unavailability
        MODIFY unavailability_id INT NOT NULL AUTO_INCREMENT
    `);

    await db.promise().query(`
        CREATE TABLE IF NOT EXISTS admin_request_state (
            state_id INT NOT NULL,
            last_seen_unavailability_id INT NOT NULL DEFAULT 0,
            PRIMARY KEY (state_id)
        )
    `);

    await db.promise().query(`
        INSERT IGNORE INTO admin_request_state (state_id, last_seen_unavailability_id)
        VALUES (1, 0)
    `);
}

ensureRequestTables().catch((error) => {
    console.error("Failed to ensure request tables on startup:", error);
});

/* -------------------------------------------------------------------------- */
/* STUDENT MANAGEMENT ROUTES                                                  */
/* -------------------------------------------------------------------------- */
app.get('/api/students', requireAuth, requireRole('admin'), (req, res) => {
    const query = `
        SELECT 
            year_of_join, 
            branch, 
            batch, 
            COUNT(*) AS end_serial
        FROM Student
        GROUP BY year_of_join, branch, batch
        ORDER BY year_of_join DESC, branch ASC, batch ASC
    `;

    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// POST: Add new batch and generate student accounts
app.post('/api/students/add', requireAuth, requireRole('admin'), async (req, res) => {
    const { year, branch, batch, strength } = req.body;
    const numStrength = parseInt(strength, 10);

    if (!year || !branch || !batch || isNaN(numStrength) || numStrength <= 0) {
        return res.status(400).json({ message: "Invalid input values." });
    }

    const connection = await db.promise().getConnection();
    try {
        await connection.beginTransaction();

        // 1. Insert into Student_manage
        await connection.query(
            `INSERT INTO Student_manage (year_of_join, branch, batch, end_serial) 
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE end_serial = VALUES(end_serial)`,
            [year, branch, batch, numStrength]
        );

        // 2. Prepare Users and Student rows
        const defaultPasswordHash = await bcrypt.hash('student123', 10);
        const userRows = [];
        const studentRows = [];

        for (let i = 1; i <= numStrength; i++) {
            const uname = formatStudentUsername(year, branch, batch, i, numStrength);
            userRows.push([uname, 'student', defaultPasswordHash]);
            studentRows.push([uname, branch, batch, i, year]);
        }

        // 3. Bulk insert into Users
        await connection.query(
            `INSERT INTO Users (username, role, password) VALUES ?
             ON DUPLICATE KEY UPDATE role = VALUES(role)`,
            [userRows]
        );

        // 4. Bulk insert into Student
        await connection.query(
            `INSERT INTO Student (username, branch, batch, roll_no, year_of_join) VALUES ?
             ON DUPLICATE KEY UPDATE branch = VALUES(branch), batch = VALUES(batch), roll_no = VALUES(roll_no), year_of_join = VALUES(year_of_join)`,
            [studentRows]
        );

        await connection.commit();
        res.status(200).json({ message: `Saved successfully! Generated ${numStrength} student accounts.` });
    } catch (err) {
        await connection.rollback();
        console.error("Error adding students:", err);
        res.status(500).json({ message: err.message || "Failed to add student records." });
    } finally {
        connection.release();
    }
});

// PUT: Update batch strength and adjust student accounts
app.put('/api/students/update', requireAuth, requireRole('admin'), async (req, res) => {
    const { year, branch, batch, strength } = req.body;
    const numStrength = parseInt(strength, 10);

    if (!year || !branch || !batch || isNaN(numStrength) || numStrength <= 0) {
        return res.status(400).json({ message: "Invalid input values." });
    }

    const connection = await db.promise().getConnection();
    try {
        await connection.beginTransaction();

        // 1. Get current strength
        const [existing] = await connection.query(
            `SELECT end_serial FROM Student_manage WHERE year_of_join = ? AND branch = ? AND batch = ?`,
            [year, branch, batch]
        );
        const oldStrength = existing.length > 0 ? existing[0].end_serial : 0;

        // 2. Update Student_manage
        await connection.query(
            `UPDATE Student_manage SET end_serial = ? WHERE year_of_join = ? AND branch = ? AND batch = ?`,
            [numStrength, year, branch, batch]
        );

        // 3. If increased, add new students
        if (numStrength > oldStrength) {
            const defaultPasswordHash = await bcrypt.hash('student123', 10);
            const userRows = [];
            const studentRows = [];

            for (let i = oldStrength + 1; i <= numStrength; i++) {
                const uname = formatStudentUsername(year, branch, batch, i, numStrength);
                userRows.push([uname, 'student', defaultPasswordHash]);
                studentRows.push([uname, branch, batch, i, year]);
            }

            if (userRows.length > 0) {
                await connection.query(
                    `INSERT INTO Users (username, role, password) VALUES ?
                     ON DUPLICATE KEY UPDATE role = VALUES(role)`,
                    [userRows]
                );
                await connection.query(
                    `INSERT INTO Student (username, branch, batch, roll_no, year_of_join) VALUES ?
                     ON DUPLICATE KEY UPDATE roll_no = VALUES(roll_no)`,
                    [studentRows]
                );
            }
        } else if (numStrength < oldStrength) {
            // Remove extra students
            const userPattern = `${year}_${branch}_${batch}_%`;
            await connection.query(
                `DELETE FROM Student WHERE year_of_join = ? AND branch = ? AND batch = ? AND roll_no > ?`,
                [year, branch, batch, numStrength]
            );
            await connection.query(
                `DELETE FROM Users WHERE username LIKE ? AND username NOT IN (SELECT username FROM Student)`,
                [userPattern]
            );
        }

        await connection.commit();
        res.json({ message: `Updated successfully to ${numStrength} students!` });
    } catch (err) {
        await connection.rollback();
        console.error("Error updating students:", err);
        res.status(500).json({ message: err.message || "Failed to update students." });
    } finally {
        connection.release();
    }
});

// DELETE: Remove batch and associated student accounts
app.delete('/api/students/:year/:branch/:batch', requireAuth, requireRole('admin'), async (req, res) => {
    const { year, branch, batch } = req.params;

    const connection = await db.promise().getConnection();
    try {
        await connection.beginTransaction();

        // 1. Delete from Student_manage
        await connection.query(
            `DELETE FROM Student_manage WHERE year_of_join = ? AND branch = ? AND batch = ?`,
            [year, branch, batch]
        );

        // 2. Delete matching students from Student
        await connection.query(
            `DELETE FROM Student WHERE year_of_join = ? AND branch = ? AND batch = ?`,
            [year, branch, batch]
        );

        // 3. Delete matching users from Users
        const userPattern = `${year}_${branch}_${batch}_%`;
        await connection.query(
            `DELETE FROM Users WHERE username LIKE ? AND role = 'student'`,
            [userPattern]
        );

        await connection.commit();
        res.json({ message: `Batch ${batch} (${year} ${branch}) and its student accounts deleted successfully!` });
    } catch (err) {
        await connection.rollback();
        console.error("Error deleting students batch:", err);
        res.status(500).json({ message: err.message || "Failed to delete batch." });
    } finally {
        connection.release();
    }
});

/* -------------------------------------------------------------------------- */
/* MANAGE ROOMS ROUTES                                                        */
/* -------------------------------------------------------------------------- */

app.get('/api/rooms', requireAuth, requireRole('admin'), (req, res) => {
    db.query('SELECT * FROM Rooms ORDER BY block ASC, room_no ASC',
        (err, results) => {
            if (err) return res.status(500).json(err);
            res.json(results);
        });
});

// DELETE: Remove a room
app.delete('/api/rooms/:block/:room_no', requireAuth, requireRole('admin'), (req, res) => {
    const { block, room_no } = req.params;
    const query = 'DELETE FROM Rooms WHERE block = ? AND room_no = ?';
    
    db.query(query, [block, room_no], (err, result) => {
        if (err) {
            console.error("Delete Error:", err);
            return res.status(500).json(err);
        }
        res.json({ message: "Room deleted successfully" });
    });
});

// GET: Fetch all block names
app.get('/api/blocks', requireAuth, requireRole('admin'), (req, res) => {
    db.query('SELECT block_name FROM blocks ORDER BY block_name ASC', (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// POST: Add a new block
app.post('/api/blocks', requireAuth, requireRole('admin'), (req, res) => {
    const { block_name } = req.body;
    if (!block_name) return res.status(400).json({ message: "Block name is required" });

    db.query('INSERT INTO blocks (block_name) VALUES (?)', [block_name], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: "Block already exists" });
            return res.status(500).json(err);
        }
        res.status(200).json({ message: 'Block added successfully' });
    });
});

// DELETE: Remove a block
app.delete('/api/blocks/:name', requireAuth, requireRole('admin'), (req, res) => {
    const blockName = req.params.name;
    db.query('DELETE FROM blocks WHERE block_name = ?', [blockName], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Block deleted successfully" });
    });
});

// POST: Add or update a room
app.post('/api/rooms', requireAuth, requireRole('admin'), (req, res) => {
    const { room_no, block, capacity, cap_per_bench, col1, col2, col3, col4, col5 } = req.body;
    const query = `
        INSERT INTO Rooms 
        (room_no, block, capacity, cap_per_bench, col1, col2, col3, col4, col5)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        capacity=?, cap_per_bench=?, col1=?, col2=?, col3=?, col4=?, col5=?
    `;

    const values = [
        room_no, block, capacity, cap_per_bench, col1, col2, col3, col4, col5,
        capacity, cap_per_bench, col1, col2, col3, col4, col5
    ];

    db.query(query, values, (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Room saved successfully" });
    });
});

/* -------------------------------------------------------------------------- */
/* MANAGE TEACHERS ROUTES                                                     */
/* -------------------------------------------------------------------------- */

app.get('/api/teachers', requireAuth, requireRole('admin'), (req, res) => {
    db.query(`
        SELECT username, name, availability, department, phone 
        FROM Teacher 
        ORDER BY name ASC
    `, (err, results) => {
        if (err) return res.status(500).json({ error: "Database fetch failed" });
        res.json(results);
    });
});

app.post('/api/teachers', requireAuth, requireRole('admin'), async (req, res) => {
    const { username, password, name, department, phone } = req.body;
    const availability = "Yes";

    if (!username || !password || !name || !department || !phone) {
        return res.status(400).json({ message: "All fields are required" });
    }

    let connection;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        await connection.query(
            `INSERT INTO Users (username, role, password)
             VALUES (?, 'Teacher', ?)`,
            [username, hashedPassword]
        );

        await connection.query(
            `INSERT INTO Teacher (username, name, availability, department, phone)
             VALUES (?, ?, ?, ?, ?)`,
            [username, name, availability, department, phone]
        );

        await connection.commit();
        res.json({ message: "Teacher added successfully" });
    } catch (error) {
        if (connection) await connection.rollback();
        if (error && error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Username already exists" });
        }
        res.status(500).json({ message: "Failed to add teacher" });
    } finally {
        if (connection) connection.release();
    }
});

// DELETE: Safely delete teacher user without affecting non-teachers
app.delete('/api/teachers/:username', requireAuth, requireRole('admin'), (req, res) => {
    const targetUsername = String(req.params.username || "").trim();
    if (!targetUsername) {
        return res.status(400).json({ message: "Username is required" });
    }

    db.query("DELETE FROM Users WHERE username = ? AND LOWER(role) = 'teacher'",
        [targetUsername],
        (err, result) => {
            if (err) return res.status(500).json({ message: err.message });
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Teacher not found or user is not a teacher" });
            }
            res.json({ message: "Teacher deleted successfully" });
        });
});

app.put('/api/teachers/availability', requireAuth, requireRole('admin'), (req, res) => {
    const { username, availability } = req.body;

    db.query(
        `UPDATE Teacher SET availability = ? WHERE username = ?`,
        [availability, username],
        (err) => {
            if (err) return res.status(500).json(err);
            res.json({ message: "Availability updated successfully" });
        }
    );
});

/* -------------------------------------------------------------------------- */
/* TEACHER EXCEL UPLOAD ROUTES                                                */
/* -------------------------------------------------------------------------- */

app.get("/api/teachers/template", requireAuth, requireRole('admin'), (req, res) => {
    const templatePath = path.join(__dirname, "teacher_template1.xlsx");

    if (!fs.existsSync(templatePath)) {
        return res.status(404).json({ message: "Teacher template file not found" });
    }

    return res.download(templatePath, "teacher_template1.xlsx");
});

app.post("/api/teachers/upload-excel", requireAuth, requireRole('admin'), (req, res) => {
    upload.single("file")(req, res, async (uploadErr) => {
        if (uploadErr) {
            return res.status(400).json({ message: uploadErr.message || "File upload failed" });
        }

        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        try {
            const workbook = XLSX.readFile(req.file.path);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, {
                header: 1,
                defval: "",
                blankrows: false
            });

            if (!rows.length) {
                return res.status(400).json({ message: "Excel file is empty" });
            }

            let processedCount = 0;
            const role = "Teacher";
            const availability = "Yes";
            const hashedDefaultPassword = await bcrypt.hash("pass123", 10);

            const hasHeader = rows.length > 0 && (
                String(rows[0][0] || "").trim().toLowerCase() === "user_name" ||
                String(rows[0][0] || "").trim().toLowerCase() === "username"
            );
            const dataRows = hasHeader ? rows.slice(1) : rows;

            for (const row of dataRows) {
                const username = String(row[0] || "").trim();
                const name = String(row[1] || "").trim();
                const department = String(row[2] || "").trim();
                const phone = String(row[3] || "").trim();

                if (!username || !name || !department || !phone) {
                    continue;
                }

                await db.promise().query(
                    `INSERT INTO Users (username, role, password)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                     role=VALUES(role),
                     password=VALUES(password)`,
                    [username, role, hashedDefaultPassword]
                );

                await db.promise().query(
                    `INSERT INTO Teacher (username, name, availability, department, phone)
                     VALUES (?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                     name=VALUES(name),
                     department=VALUES(department),
                     phone=VALUES(phone),
                     availability=VALUES(availability)`,
                    [username, name, availability, department, phone]
                );

                processedCount += 1;
            }

            if (processedCount === 0) {
                return res.status(400).json({
                    message: "No valid rows found in Excel",
                    hint: "Required Excel order: username, name, department, phone"
                });
            }
            res.json({ message: `Teachers uploaded successfully (${processedCount} rows)` });
        } catch (error) {
            console.error("Excel upload processing error:", error);
            res.status(500).json({
                message: "Excel upload failed",
                error: error?.message || "Unknown server error"
            });
        } finally {
            if (req.file && req.file.path && fs.existsSync(req.file.path)) {
                fs.unlink(req.file.path, () => {});
            }
        }
    });
});

/* -------------------------------------------------------------------------- */
/* EXAM SCHEDULE ROUTES                                                       */
/* -------------------------------------------------------------------------- */

// GET ALL EXAMS
app.get('/api/exam-schedule', requireAuth, requireRole('admin'), (req, res) => {
    const buildQuery = (tableName) => `
        SELECT *
        FROM ${tableName}
        ORDER BY exam_date ASC, session ASC, branch ASC
    `;

    db.query(buildQuery('Exam_schedule'), (err, results) => {
        if (!err) return res.json(results);
        if (err.code !== 'ER_NO_SUCH_TABLE') return res.status(500).json(err);

        db.query(buildQuery('exam_schedule'), (fallbackErr, fallbackResults) => {
            if (fallbackErr) return res.status(500).json(fallbackErr);
            return res.json(fallbackResults);
        });
    });
});

// ADD EXAM
app.post('/api/exam-schedule/add', requireAuth, requireRole('admin'), async (req, res) => {
    const yearVal = req.body.year ?? req.body.academicYear;
    const dateVal = req.body.date ?? req.body.examDate;
    const session = req.body.session;
    const examNumber = req.body.examNumber ?? req.body.exam_number ?? 1;

    const formattedDate = safeFormatDate(dateVal);
    if (!formattedDate) {
        return res.status(400).json({ message: "Invalid exam date provided" });
    }

    let values = [];
    if (req.body.subjects && typeof req.body.subjects === 'object' && !Array.isArray(req.body.subjects)) {
        values = Object.entries(req.body.subjects)
            .filter(([_, sub]) => sub?.name && String(sub.name).trim() !== "")
            .map(([branch, sub]) => [
                Number(yearVal),
                Number(examNumber) || 1,
                formattedDate,
                session,
                branch,
                String(sub.name || '').trim(),
                String(sub.code || '').trim()
            ]);
    } else if (Array.isArray(req.body.branches)) {
        values = req.body.branches
            .filter(b => (b.subjectName || b.subject) && String(b.subjectName || b.subject).trim() !== "")
            .map(b => [
                Number(yearVal),
                Number(examNumber) || 1,
                formattedDate,
                session,
                b.branch,
                String(b.subjectName || b.subject || '').trim(),
                String(b.subjectCode || b.sub_code || '').trim()
            ]);
    }

    if (!values.length) {
        return res.status(400).json({ message: "At least one subject is required" });
    }

    try {
        await db.promise().query(
            `INSERT INTO Exam_schedule
            (year, exam_number, exam_date, session, branch, subject, sub_code)
            VALUES ?`,
            [values]
        );
        res.json({ message: "Exam schedule added successfully" });
    } catch (err) {
        console.error("Exam schedule add error:", err);
        res.status(500).json({ message: err.message || "Error saving exam schedule" });
    }
});

// UPDATE EXAM
app.put('/api/exam-schedule/update/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const yearVal = req.body.year ?? req.body.academicYear;
    const dateVal = req.body.date ?? req.body.examDate;
    const session = req.body.session;
    const examNumber = req.body.examNumber ?? req.body.exam_number ?? 1;

    const formattedDate = safeFormatDate(dateVal);
    if (!formattedDate) {
        return res.status(400).json({ message: "Invalid exam date provided" });
    }

    let branch = "";
    let subName = "";
    let subCode = "";

    if (req.body.subjects && typeof req.body.subjects === 'object' && !Array.isArray(req.body.subjects)) {
        const subjectEntry = Object.entries(req.body.subjects)
            .find(([_, sub]) => sub?.name && String(sub.name).trim() !== "");
        if (subjectEntry) {
            branch = subjectEntry[0];
            subName = subjectEntry[1].name;
            subCode = subjectEntry[1].code;
        }
    } else if (Array.isArray(req.body.branches) && req.body.branches.length > 0) {
        const b = req.body.branches[0];
        branch = b.branch;
        subName = b.subjectName || b.subject;
        subCode = b.subjectCode || b.sub_code;
    }

    if (!subName || String(subName).trim() === "") {
        return res.status(400).json({ message: "At least one subject is required" });
    }

    const updateValues = [
        Number(yearVal),
        Number(examNumber) || 1,
        formattedDate,
        session,
        branch,
        String(subName || '').trim(),
        String(subCode || '').trim(),
        req.params.id
    ];

    try {
        await db.promise().query(
            `UPDATE Exam_schedule
            SET year = ?, exam_number = ?, exam_date = ?, session = ?, branch = ?, subject = ?, sub_code = ?
            WHERE exam_id = ?`,
            updateValues
        );
        res.json({ message: "Exam schedule updated successfully" });
    } catch (err) {
        console.error("Exam schedule update error:", err);
        res.status(500).json({ message: err.message || "Error saving exam schedule" });
    }
});

// DELETE EXAM
app.delete('/api/exam-schedule/:id', requireAuth, requireRole('admin'), (req, res) => {
    const runDelete = (tableName) => {
        const query = `DELETE FROM ${tableName} WHERE exam_id = ?`;
        return new Promise((resolve, reject) => {
            db.query(query, [req.params.id], (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });
    };

    runDelete('Exam_schedule')
        .then(() => res.json({ message: "Exam deleted successfully" }))
        .catch((err) => {
            if (err.code !== 'ER_NO_SUCH_TABLE') return res.status(500).json(err);
            runDelete('exam_schedule')
                .then(() => res.json({ message: "Exam deleted successfully" }))
                .catch((fallbackErr) => res.status(500).json(fallbackErr));
        });
});

/* -------------------------------------------------------------------------- */
/* LOGIN ROUTES                                                               */
/* -------------------------------------------------------------------------- */

app.post("/api/login", authRateLimiter, (req, res) => {

    const usernameInput = String(req.body.username || "");
    const passwordInput = String(req.body.password || "");
    const roleInput = String(req.body.role || "");

    const username = usernameInput.trim();
    const role = roleInput.trim();

    if (!username || !passwordInput || !role) {
        return res.status(400).json({ message: "Username, password, and role are required." });
    }

    // Prepare candidate usernames (supports both unpadded and zero-padded login for students)
    let candidateUsernames = [username.toLowerCase()];
    const matchStudentPattern = username.match(/^(\d{4}_[A-Za-z]+_[A-Za-z0-9]+_)(\d+)$/);
    if (matchStudentPattern) {
        const prefix = matchStudentPattern[1].toLowerCase();
        const num = parseInt(matchStudentPattern[2], 10);
        candidateUsernames.push(`${prefix}${String(num).padStart(2, '0')}`);
        candidateUsernames.push(`${prefix}${String(num).padStart(3, '0')}`);
        candidateUsernames.push(`${prefix}${num}`);
    }
    candidateUsernames = [...new Set(candidateUsernames)];

    const query = `
        SELECT * FROM Users
        WHERE LOWER(TRIM(username)) IN (?)
          AND LOWER(TRIM(role)) = LOWER(?)
        LIMIT 1
    `;

    db.query(query, [candidateUsernames, role], async (err, results) => {

        if (err) {
            console.error("Login database error:", err);
            return res.status(500).json({ message: "Server error during authentication" });
        }

        if (results.length === 0)
            return res.status(401).json({ message: "Invalid login credentials" });

        const user = results[0];

        let match = false;
        const storedPassword = String(user.password || "").trim();

        if (BCRYPT_HASH_PREFIX.test(storedPassword)) {
            match = await bcrypt.compare(passwordInput, storedPassword);
        } else if (
            passwordInput === storedPassword ||
            passwordInput.trim() === storedPassword
        ) {
            match = true;

            try {
                const hashedPassword = await bcrypt.hash(passwordInput, 10);
                await db.promise().query(
                    "UPDATE Users SET password = ? WHERE username = ? AND role = ?",
                    [hashedPassword, user.username, user.role]
                );
            } catch (hashUpdateError) {
                console.error("Failed to upgrade plain-text password to hash:", hashUpdateError);
            }
        }

        if (!match)
            return res.status(401).json({ message: "Invalid login credentials" });

        const token = jwt.sign(
            { username: user.username, role: user.role },
            SECRET_KEY,
            { expiresIn: "4h" }
        );

        res.json({
            success: true,
            role: user.role,
            username: user.username,
            token: token
        });

    });

});

app.post("/api/teacher/change-password", requireAuth, requireRole('teacher'), async (req, res) => {
    const user = req.user;

    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");
    const confirmPassword = String(req.body.confirmPassword || "");

    if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ message: "All password fields are required" });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters long" });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: "New password and retyped password do not match" });
    }

    try {
        const [results] = await db.promise().query(
            `SELECT username, role, password
             FROM Users
             WHERE LOWER(TRIM(username)) = LOWER(?)
               AND LOWER(TRIM(role)) = 'teacher'
             LIMIT 1`,
            [String(user.username || "").trim()]
        );

        if (!results.length) {
            return res.status(404).json({ message: "Teacher account not found" });
        }

        const teacherUser = results[0];
        const storedPassword = String(teacherUser.password || "").trim();

        let currentPasswordMatches = false;

        if (BCRYPT_HASH_PREFIX.test(storedPassword)) {
            currentPasswordMatches = await bcrypt.compare(currentPassword, storedPassword);
        } else if (
            currentPassword === storedPassword ||
            currentPassword.trim() === storedPassword
        ) {
            currentPasswordMatches = true;
        }

        if (!currentPasswordMatches) {
            return res.status(401).json({ message: "Current password is incorrect" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.promise().query(
            `UPDATE Users
             SET password = ?
             WHERE username = ? AND role = ?`,
            [hashedPassword, teacherUser.username, teacherUser.role]
        );

        return res.json({ message: "Password changed successfully" });
    } catch (error) {
        console.error("Failed to change teacher password:", error);
        return res.status(500).json({ message: "Failed to change password" });
    }
});

// SIGNUP: Public registration restricted to Student and Teacher roles
app.post("/api/signup", authRateLimiter, async (req, res) => {
    const rawUsername = String(req.body.username || "").trim();
    const rawPassword = String(req.body.password || "");
    const rawRole = String(req.body.role || "").trim();

    if (!rawUsername || !rawPassword || !rawRole) {
        return res.status(400).json({ message: "Username, password, and role are required." });
    }

    if (rawUsername.length < 3 || rawUsername.length > 50) {
        return res.status(400).json({ message: "Username must be between 3 and 50 characters." });
    }

    if (rawPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }

    const normalizedRole = rawRole.toLowerCase();
    if (!["student", "teacher"].includes(normalizedRole)) {
        return res.status(400).json({ message: "Invalid role. Only Student and Teacher signups are permitted." });
    }

    const canonicalRole = normalizedRole === "student" ? "student" : "Teacher";

    const connection = await db.promise().getConnection();
    try {
        await connection.beginTransaction();

        const [existing] = await connection.query(
            "SELECT username FROM Users WHERE LOWER(username) = LOWER(?) LIMIT 1",
            [rawUsername]
        );

        if (existing.length > 0) {
            await connection.rollback();
            return res.status(409).json({ message: "Username already exists. Please choose a different one." });
        }

        const hashedPassword = await bcrypt.hash(rawPassword, 10);

        await connection.query(
            "INSERT INTO Users (username, role, password) VALUES (?, ?, ?)",
            [rawUsername, canonicalRole, hashedPassword]
        );

        if (normalizedRole === "teacher") {
            await connection.query(
                "INSERT INTO Teacher (username, name, availability, department, phone) VALUES (?, ?, 'Yes', 'General', '') ON DUPLICATE KEY UPDATE availability='Yes'",
                [rawUsername, rawUsername]
            );
        } else if (normalizedRole === "student") {
            const currentYear = new Date().getFullYear();
            await connection.query(
                "INSERT INTO Student (username, branch, batch, roll_no, year_of_join) VALUES (?, 'General', 'A', 0, ?) ON DUPLICATE KEY UPDATE year_of_join=VALUES(year_of_join)",
                [rawUsername, currentYear]
            );
        }

        await connection.commit();
        res.status(201).json({ message: "User account created successfully! You can now log in." });
    } catch (error) {
        await connection.rollback();
        console.error("Signup error:", error);
        res.status(500).json({ message: "Server error creating user account." });
    } finally {
        connection.release();
    }
});




// ----------------------------------------------------------------------------
//                         SEATING ALLOCATION ROUTES
// ----------------------------------------------------------------------------

// GET: Fetch required data for the Allocation page
app.get('/api/allocation/init', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        // Fetch rooms for the toggle list
        const [rooms] = await db.promise().query('SELECT block, room_no, capacity FROM Rooms ORDER BY block, room_no');
        
        // Fetch student counts grouped by join year
        const [[maxRow]] = await db.promise().query('SELECT MAX(year_of_join) AS maxYear FROM Student');
        const baseYear = (maxRow && maxRow.maxYear) ? Number(maxRow.maxYear) : new Date().getFullYear();
        const [students] = await db.promise().query(`
            SELECT 
                (${baseYear} - year_of_join + 1) AS academic_year,
                SUM(end_serial) as total_students
            FROM Student_manage 
            GROUP BY year_of_join
        `);
        
        const formattedStudents = students.map(s => ({
            academic_year: Number(s.academic_year),
            total_students: Number(s.total_students)
        }));

        // Fetch distinct scheduled exam dates and sessions
        const [examSlots] = await db.promise().query(`
            SELECT DISTINCT exam_date, session 
            FROM Exam_schedule 
            ORDER BY exam_date ASC, 
                     CASE session WHEN 'FN' THEN 1 WHEN 'AN' THEN 2 ELSE 3 END ASC
        `);

        const formattedSlots = examSlots.map(s => ({
            exam_date: safeFormatDate(s.exam_date),
            session: s.session
        })).filter(s => Boolean(s.exam_date));

        const scheduledDates = [...new Set(formattedSlots.map(s => s.exam_date))];

        res.json({ 
            rooms, 
            students: formattedStudents,
            scheduledSlots: formattedSlots,
            scheduledDates
        });
    } catch (err) {
        console.error("Allocation Init Error:", err);
        res.status(500).json({ error: "Database fetch failed" });
    }
});


// POST: Generate Allocation
app.post('/api/allocation/generate', requireAuth, requireRole('admin'), async (req, res) => {
    const { examDate, session, selectedYears, selectedRooms } = req.body;
    const formattedDate = safeFormatDate(examDate);

    if (!formattedDate || !session || !selectedYears?.length || !selectedRooms?.length) {
        return res.status(400).json({ message: "Missing required fields." });
    }

    const connection = await db.promise().getConnection();

    try {
        await connection.beginTransaction();

        // 1️⃣ Fetch Exam(s) for this specific slot
        const [examRows] = await connection.query(
            `SELECT * FROM Exam_schedule
             WHERE exam_date = ? AND session = ?`,
            [formattedDate, session]
        );

        if (!examRows.length) {
            await connection.rollback();
            return res.status(400).json({ message: "No scheduled exams found for this date and session." });
        }

        const exam_id = examRows[0].exam_id;
        const examIds = examRows.map(e => e.exam_id);

        const examMap = {};
        examRows.forEach(row => {
            examMap[`${row.year}_${row.branch}`] = row.exam_id;
        });

        // Delete existing seating for THIS slot's exams only (leaves all other dates & slots intact)
        await connection.query(
            `DELETE FROM Seating_allocation WHERE exam_id IN (?)`,
            [examIds]
        );

        // 2️⃣ Fetch Selected Rooms (sorted)
        const [rooms] = await connection.query(
            `SELECT * FROM Rooms
             WHERE CONCAT(block, room_no) IN (?)
             ORDER BY block ASC, room_no ASC`,
            [selectedRooms]
        );

        if (!rooms.length) {
            await connection.rollback();
            return res.status(400).json({ message: "Rooms not found." });
        }

        // 3️⃣ Convert academic year → join year
        const [[maxRow]] = await connection.query('SELECT MAX(year_of_join) AS maxYear FROM Student');
        const baseYear = (maxRow && maxRow.maxYear) ? Number(maxRow.maxYear) : new Date().getFullYear();
        const joinYears = selectedYears.map(y =>
            baseYear - Number(y) + 1
        );

        // 4️⃣ Fetch Students (from Student table first to ensure accurate usernames, fallback to Student_manage)
        const [studentRows] = await connection.query(
            `SELECT username, branch, batch, roll_no, year_of_join
             FROM Student
             WHERE year_of_join IN (?)
             ORDER BY year_of_join ASC, branch ASC, batch ASC, roll_no ASC`,
            [joinYears]
        );

        // 5️⃣ Build Year Queues
        const yearQueues = {};
        if (studentRows.length > 0) {
            studentRows.forEach(row => {
                if (!yearQueues[row.year_of_join])
                    yearQueues[row.year_of_join] = [];

                yearQueues[row.year_of_join].push({
                    username: row.username,
                    branch: row.branch,
                    batch: row.batch,
                    roll_no: row.roll_no,
                    year: row.year_of_join
                });
            });
        } else {
            const [manageRows] = await connection.query(
                `SELECT year_of_join, branch, batch, end_serial
                 FROM Student_manage
                 WHERE year_of_join IN (?)
                 ORDER BY year_of_join ASC, branch ASC, batch ASC`,
                [joinYears]
            );

            if (!manageRows.length) {
                await connection.rollback();
                return res.status(400).json({ message: "No students found." });
            }

            manageRows.forEach(row => {
                if (!yearQueues[row.year_of_join])
                    yearQueues[row.year_of_join] = [];

                for (let i = 1; i <= row.end_serial; i++) {
                    yearQueues[row.year_of_join].push({
                        username: formatStudentUsername(row.year_of_join, row.branch, row.batch, i, row.end_serial),
                        branch: row.branch,
                        batch: row.batch,
                        roll_no: i,
                        year: row.year_of_join
                    });
                }
            });
        }

        const yearList = Object.keys(yearQueues).sort();
        let globalYearPointer = 0;

        // =========================
        // STRICT GLOBAL ALLOCATION
        // =========================
        for (let room of rooms) {

            const columns = [room.col1, room.col2, room.col3, room.col4, room.col5]
                .filter(c => c > 0);

            for (let colIndex = 0; colIndex < columns.length; colIndex++) {
                const benchesInColumn = Number(columns[colIndex]) || 0;

                let assignedYear = null;
                let attempts = 0;

                // strict rotation
                while (attempts < yearList.length) {

                    const yearKey = yearList[globalYearPointer % yearList.length];

                    globalYearPointer++;

                    if (yearQueues[yearKey]?.length) {
                        assignedYear = yearKey;
                        break;
                    }

                    attempts++;
                }

                if (!assignedYear) break;

                for (let bench = 1; bench <= benchesInColumn; bench++) {

                    // LEFT
                    if (yearQueues[assignedYear]?.length) {

                        const student = yearQueues[assignedYear].shift();
                        const studentAcadYear = baseYear - student.year + 1;
                        const targetExamId = examMap[`${studentAcadYear}_${student.branch}`] || exam_id;

                        await connection.query(
                            `INSERT INTO Seating_allocation
                            (exam_id, room_no, block,
                             column_no, bench_no, seat_position,
                             username, batch, roll_no, branch, session)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                targetExamId,
                                room.room_no,
                                room.block,
                                colIndex + 1,
                                bench,
                                "left",
                                student.username,
                                student.batch,
                                student.roll_no,
                                student.branch,
                                session
                            ]
                        );
                    }

                    // RIGHT (if 2 per bench)
                    if (room.cap_per_bench === 2) {

                        let rightYear = null;
                        let rightAttempts = 0;

                        while (rightAttempts < yearList.length) {

                            const yearKey = yearList[globalYearPointer % yearList.length];
                            globalYearPointer++;

                            if (yearQueues[yearKey]?.length && yearKey !== assignedYear) {
                                rightYear = yearKey;
                                break;
                            }

                            rightAttempts++;
                        }

                        if (rightYear && yearQueues[rightYear]?.length) {

                            const student = yearQueues[rightYear].shift();
                            const studentAcadYear = baseYear - student.year + 1;
                            const targetExamId = examMap[`${studentAcadYear}_${student.branch}`] || exam_id;

                            await connection.query(
                                `INSERT INTO Seating_allocation
                                (exam_id, room_no, block,
                                 column_no, bench_no, seat_position,
                                 username, batch, roll_no, branch, session)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                [
                                    targetExamId,
                                    room.room_no,
                                    room.block,
                                    colIndex + 1,
                                    bench,
                                    "right",
                                    student.username,
                                    student.batch,
                                    student.roll_no,
                                    student.branch,
                                    session
                                ]
                            );
                        }
                    }
                }
            }
        }

        // Upsert into Allocation_History for this slot
        await connection.query(
            `INSERT INTO Allocation_History (exam_date, session, selected_years, selected_rooms)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
                 selected_years = VALUES(selected_years), 
                 selected_rooms = VALUES(selected_rooms)`,
            [formattedDate, session, JSON.stringify(selectedYears), JSON.stringify(selectedRooms)]
        );

        const hallWisePdfBuffer = await generateHallSeatingPdfByExamId(connection, exam_id, formattedDate);
        const totalSeatingPdfBuffer = await generateTotalSeatingPdfByExamId(connection, exam_id, formattedDate);

        const nextHallWiseReportNumber = await getNextHallWiseReportNumber(connection);
        const hallWiseReportName = `hall-wise-report${nextHallWiseReportNumber}`;
        const hallWiseFileName = `${hallWiseReportName}.pdf`;
        const hallWiseFilePath = path.join(generatedReportsDir, hallWiseFileName);

        const nextTotalSeatingReportNumber = await getNextTotalSeatingReportNumber(connection);
        const totalSeatingReportName = `total-seating-report${nextTotalSeatingReportNumber}`;
        const totalSeatingFileName = `${totalSeatingReportName}.pdf`;
        const totalSeatingFilePath = path.join(generatedReportsDir, totalSeatingFileName);

        fs.writeFileSync(hallWiseFilePath, hallWisePdfBuffer);
        fs.writeFileSync(totalSeatingFilePath, totalSeatingPdfBuffer);

        const [[reportIdRow]] = await connection.query(
            `SELECT COALESCE(MAX(report_id), 0) + 1 AS nextReportId FROM Reports`
        );

        await connection.query(
            `INSERT INTO Reports (report_id, report_type, exam_date, report_name, filepath)
             VALUES (?, ?, ?, ?, ?)`,
            [reportIdRow.nextReportId, "Hall-wise", formattedDate, hallWiseReportName, hallWiseFileName]
        );

        await connection.query(
            `INSERT INTO Reports (report_id, report_type, exam_date, report_name, filepath)
             VALUES (?, ?, ?, ?, ?)`,
            [reportIdRow.nextReportId + 1, "Total Seating", formattedDate, totalSeatingReportName, totalSeatingFileName]
        );

        await connection.commit();

        res.json({
            message: "Allocation generated successfully",
            reportName: hallWiseReportName,
            totalSeatingReportName
        });

    } catch (error) {
        await connection.rollback();
        console.error("Allocation generation error:", error);
        res.status(500).json({
            message: "Allocation failed: " + error.message
        });
    } finally {
        connection.release();
    }
});

// ----------------------------------------------------------------------------
//                         SAVE & FETCH SELECTION ROUTES
// ----------------------------------------------------------------------------

app.post('/api/allocation/save', requireAuth, requireRole('admin'), (req, res) => {
    const { examDate, session, selectedYears, selectedRooms } = req.body;
    const formattedDate = safeFormatDate(examDate);
    if (!formattedDate || !session) {
        return res.status(400).json({ error: "Valid date and session required" });
    }
    const yearsStr = JSON.stringify(selectedYears || []);
    const roomsStr = JSON.stringify(selectedRooms || []);

    const query = `
        INSERT INTO Allocation_History (exam_date, session, selected_years, selected_rooms)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
            selected_years = VALUES(selected_years), 
            selected_rooms = VALUES(selected_rooms)
    `;

    db.query(query, [formattedDate, session, yearsStr, roomsStr], (err, result) => {
        if (err) return res.status(500).json({ error: "Failed to save selection" });
        res.json({ message: "Selection saved successfully" });
    });
});

app.get('/api/allocation/saved-state', requireAuth, requireRole('admin'), async (req, res) => {
    const { examDate, session } = req.query;
    let query = 'SELECT * FROM Allocation_History ORDER BY updated_at DESC LIMIT 1';
    let params = [];

    const formattedDate = examDate ? safeFormatDate(examDate) : null;
    if (formattedDate && session) {
        query = 'SELECT * FROM Allocation_History WHERE DATE(exam_date) = ? AND session = ? ORDER BY updated_at DESC LIMIT 1';
        params = [formattedDate, session];
    }

    try {
        const [results] = await db.promise().query(query, params);
        let isGenerated = false;

        if (formattedDate && session) {
            const [[allocCheck]] = await db.promise().query(
                `SELECT COUNT(*) AS count
                 FROM Seating_allocation sa
                 JOIN Exam_schedule es ON es.exam_id = sa.exam_id
                 WHERE DATE(es.exam_date) = ? AND (es.session = ? OR sa.session = ?)`,
                [formattedDate, session, session]
            );
            isGenerated = Number(allocCheck?.count || 0) > 0;
        }

        if (results.length > 0) {
            const data = results[0];
            res.json({
                examDate: safeFormatDate(data.exam_date),
                session: data.session,
                selectedYears: JSON.parse(data.selected_years || '[]'),
                selectedRooms: JSON.parse(data.selected_rooms || '[]'),
                isGenerated
            });
        } else {
            res.json({
                examDate: formattedDate,
                session: session,
                selectedYears: [],
                selectedRooms: [],
                isGenerated
            });
        }
    } catch (err) {
        console.error("Failed to fetch saved allocation state:", err);
        res.status(500).json({ message: "Failed to fetch allocation state." });
    }
});

// DELETE: Remove seating allocation for a specific slot
app.delete('/api/allocation/delete', requireAuth, requireRole('admin'), async (req, res) => {
    const { date, session } = req.body;
    const formattedDate = safeFormatDate(date);
    if (!formattedDate || !session) {
        return res.status(400).json({ message: "Valid date and session are required." });
    }

    const connection = await db.promise().getConnection();
    try {
        await connection.beginTransaction();

        const [examRows] = await connection.query(
            `SELECT exam_id FROM Exam_schedule WHERE exam_date = ? AND session = ?`,
            [formattedDate, session]
        );

        if (examRows.length > 0) {
            const examIds = examRows.map(e => e.exam_id);
            await connection.query(
                `DELETE FROM Seating_allocation WHERE exam_id IN (?)`,
                [examIds]
            );
        }

        await connection.query(
            `DELETE FROM Allocation_History WHERE exam_date = ? AND session = ?`,
            [formattedDate, session]
        );

        await connection.commit();
        res.json({ message: "Seating allocation deleted successfully." });
    } catch (err) {
        await connection.rollback();
        console.error("Failed to delete seating allocation:", err);
        res.status(500).json({ message: "Failed to delete seating allocation." });
    } finally {
        connection.release();
    }
});

// ----------------------------------------------------------------------------
//                        REPORT ROUTES
// ----------------------------------------------------------------------------
const puppeteer = require("puppeteer");

async function buildHallSeatingRows(connection, examId) {
    const query = `
SELECT 
    s.room_no,
    s.block,
    s.column_no,
    s.bench_no,
    s.seat_position,
    s.username,
    s.branch,
    s.batch,
    s.roll_no,
    r.cap_per_bench,
    r.col1,
    r.col2,
    r.col3,
    r.col4,
    r.col5
FROM Seating_allocation s
JOIN Rooms r ON s.room_no = r.room_no AND s.block = r.block
WHERE s.exam_id = ?
ORDER BY s.block, s.room_no, s.column_no, s.bench_no
`;

    const [rows] = await connection.query(query, [examId]);
    return rows;
}



function getStudentYear(batch, examDate) {
    const admissionYear = parseInt(batch, 10);

    if (Number.isNaN(admissionYear)) {
        return "";
    }

    const date = new Date(examDate);
    const examYear = date.getFullYear();
    const examMonth = date.getMonth() + 1;

    const promotionMonth = 7; // July (KTU promotion month)

    let year = examYear - admissionYear + 1;

    if (examMonth < promotionMonth) {
        year--;
    }

    if (year < 1) year = 1;
    if (year > 4) year = 4;

    return "Y" + year;
}

function formatExamDateForReport(examDate) {
    const date = new Date(examDate);

    if (Number.isNaN(date.getTime())) {
        return examDate;
    }

    const day = String(date.getDate()).padStart(2, "0");
    const month = date.toLocaleString("en-US", { month: "long" });
    const year = date.getFullYear();

    return `${day} ${month} ${year}`;
}

async function resolveHallSeatingExamDate(connection, examDate) {
    const [rows] = await connection.query(
        `SELECT exam_date
         FROM Allocation_History
         WHERE exam_date = ?
         ORDER BY id DESC
         LIMIT 1`,
        [examDate]
    );

    return rows.length ? rows[0].exam_date : examDate;
}

async function getAllocationHistoryReportMeta(connection, examDate) {
    const [rows] = await connection.query(
        `SELECT exam_date, selected_years
         FROM Allocation_History
         WHERE exam_date = ?
         ORDER BY id DESC
         LIMIT 1`,
        [examDate]
    );

    if (rows.length) {
        return rows[0];
    }

    const [fallbackRows] = await connection.query(
        `SELECT exam_date, selected_years
         FROM Allocation_History
         ORDER BY id DESC
         LIMIT 1`
    );

    return fallbackRows.length
        ? fallbackRows[0]
        : { exam_date: examDate, selected_years: "[]" };
}

function formatSelectedYearsForReport(selectedYears) {
    let parsedYears = selectedYears;

    if (typeof parsedYears === "string") {
        try {
            parsedYears = JSON.parse(parsedYears);
        } catch (error) {
            parsedYears = [];
        }
    }

    if (!Array.isArray(parsedYears)) {
        return "";
    }

    return parsedYears
        .map(year => `Y${String(year).trim()}`)
        .filter(Boolean)
        .join(",");
}


function buildHallSeatingHtml(rows, examDate) {
    const rooms = {};
    const formattedExamDate = formatExamDateForReport(examDate);
    const getJoinYearFromUsername = (username) => {
        const [joinYear] = String(username || "").split("_");
        const parsedYear = parseInt(joinYear, 10);
        return Number.isNaN(parsedYear) ? null : parsedYear;
    };
    const formatClassLabel = (branch, batch) =>
        [branch, batch].filter(Boolean).join(" ").trim();
    const createHeaderEntry = (yearLabel, classLabel) => ({
        year: yearLabel,
        className: classLabel
    });
    const headerEntryExists = (entries, nextEntry) =>
        entries.some(entry =>
            entry.year === nextEntry.year && entry.className === nextEntry.className
        );
    const renderHeaderEntries = (entries) =>
        entries
            .slice()
            .sort((a, b) => a.year.localeCompare(b.year) || a.className.localeCompare(b.className))
            .map(entry => `<div>${entry.year}${entry.className ? ` ${entry.className}` : ""}</div>`)
            .join("");
    const renderRoomClassCounts = (classCounts) =>
        [...classCounts.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([label, count]) => `<div class="summary-line">${label} : ${count}</div>`)
            .join("");

    rows.forEach(r => {
        const key = `${r.block}-${r.room_no}`;

        if (!rooms[key]) {
            const columns = [r.col1, r.col2, r.col3, r.col4, r.col5]
                .filter(c => c && c > 0);
            const maxRows = Math.max(...columns);

            rooms[key] = {
                seats: [],
                columns: columns,
                maxRows: maxRows,
                cap: r.cap_per_bench,
                columnClasses: {},
                subColumnClasses: {},
                classCounts: new Map()
            };
        }

        rooms[key].seats.push(r);

        const joinYear = getJoinYearFromUsername(r.username);
        const yearLabel = joinYear ? getStudentYear(joinYear, examDate) : "";
        const classLabel = formatClassLabel(r.branch, r.batch);

        if (!yearLabel && !classLabel) {
            return;
        }

        const headerEntry = createHeaderEntry(yearLabel, classLabel);
        const roomClassLabel = [yearLabel, classLabel].filter(Boolean).join(" ").trim();

        if (roomClassLabel) {
            const currentCount = rooms[key].classCounts.get(roomClassLabel) || 0;
            rooms[key].classCounts.set(roomClassLabel, currentCount + 1);
        }

        if (rooms[key].cap === 2) {
            if (!rooms[key].subColumnClasses[r.column_no]) {
                rooms[key].subColumnClasses[r.column_no] = { left: [], right: [] };
            }

            const seatKey = r.seat_position === "right" ? "right" : "left";
            if (!headerEntryExists(rooms[key].subColumnClasses[r.column_no][seatKey], headerEntry)) {
                rooms[key].subColumnClasses[r.column_no][seatKey].push(headerEntry);
            }
        } else {
            if (!rooms[key].columnClasses[r.column_no]) {
                rooms[key].columnClasses[r.column_no] = [];
            }

            if (!headerEntryExists(rooms[key].columnClasses[r.column_no], headerEntry)) {
                rooms[key].columnClasses[r.column_no].push(headerEntry);
            }
        }
    });

    let html = `
        <html>
        <head>

        <style>

        body{
            font-family: Arial;
            text-align:center;
        }

        .college{
            font-size:20px;
            font-weight:bold;
        }

        .exam-title,
        .exam-date-line{
            font-size:18px;
            font-weight:bold;
            margin-top:6px;
        }

        .room{
            font-size:22px;
            margin-top:30px;
        }

        table{
            border-collapse:collapse;
            margin:auto;
            margin-top:20px;
        }

        th,td{
            border:1px solid black;
            padding:8px;
            width:60px;
        }

        .column-label{
            font-size:16px;
            font-weight:bold;
            display:block;
        }

        .class-label{
            display:block;
            margin-top:4px;
            font-size:11px;
            font-weight:normal;
            line-height:1.4;
            white-space:pre-line;
        }

        .grey-cell{
            background:#bfbfbf;
        }

        .page{
            page-break-after:always;
        }

        .room-summary{
            width:80%;
            margin:24px auto 0;
            display:flex;
            justify-content:space-between;
            align-items:flex-start;
            gap:24px;
            text-align:left;
        }

        .summary-left{
            font-size:16px;
            font-weight:bold;
        }

        .summary-right{
            min-width:220px;
            font-size:14px;
        }

        .summary-line{
            margin-bottom:8px;
            font-weight:bold;
        }

        </style>

        </head>

        <body>
        `;

    Object.keys(rooms).forEach(room => {

        html += `<div class="page">`;

        html += `
        <div class="college">
        ST. JOSEPH'S COLLEGE OF ENGINEERING & TECHNOLOGY, PALAI
        </div>

        <div class="exam-title">
        B.TECH INTERNAL TEST
        </div>

        <div class="exam-date-line">
        SEATING ARRANGEMENT - ${formattedExamDate}
        </div>
        `;

        html += `<div class="room">Room: ${room}</div>`;

        html += `<table>`;

        /* MAIN COLUMN HEADER */

        html += `<tr>`;

        rooms[room].columns.forEach((_, index) => {

            const letter = String.fromCharCode(65 + index);
            const classLabels = renderHeaderEntries(rooms[room].columnClasses[index + 1] || []);
            const headerContent = rooms[room].cap === 2
                ? `<span class="column-label">${letter}</span>`
                : `
                <span class="column-label">${letter}</span>
                <span class="class-label">${classLabels}</span>
            `;

            if (rooms[room].cap === 2)
                html += `<th colspan="2">${headerContent}</th>`;
            else
                html += `<th>${headerContent}</th>`;

        });

        html += `</tr>`;


        /* SUB HEADER ONLY IF 2 PER BENCH */

        if (rooms[room].cap === 2) {

            html += `<tr>`;

            rooms[room].columns.forEach((_, index) => {
                const classes = rooms[room].subColumnClasses[index + 1] || { left: [], right: [] };
                const leftLabels = renderHeaderEntries(classes.left);
                const rightLabels = renderHeaderEntries(classes.right);

                html += `<th><span class="class-label">${leftLabels}</span></th>`;
                html += `<th><span class="class-label">${rightLabels}</span></th>`;

            });

            html += `</tr>`;
        }


        /* BUILD SEAT MAP */

        const grid = {};

        rooms[room].seats.forEach(seat => {

            if (!grid[seat.bench_no])
                grid[seat.bench_no] = {};

            if (!grid[seat.bench_no][seat.column_no])
                grid[seat.bench_no][seat.column_no] = {};

            if (rooms[room].cap === 2) {

                grid[seat.bench_no][seat.column_no][seat.seat_position] =
                    seat.roll_no;

            } else {

                grid[seat.bench_no][seat.column_no].left =
                    seat.roll_no;

            }

        });


        /* GENERATE TABLE ROWS */

        for (let r = 1; r <= rooms[room].maxRows; r++) {

            html += `<tr>`;

            rooms[room].columns.forEach((_, cIndex) => {

                const col = cIndex + 1;
                const benchCount = rooms[room].columns[cIndex];
                const seat = (grid[r] && grid[r][col]) ? grid[r][col] : {};
                const hasBench = r <= benchCount;

                if (rooms[room].cap === 2) {
                    const leftClass = hasBench && seat.left ? "" : ` class="grey-cell"`;
                    const rightClass = hasBench && seat.right ? "" : ` class="grey-cell"`;

                    html += `<td${leftClass}>${seat.left || ""}</td>`;
                    html += `<td${rightClass}>${seat.right || ""}</td>`;

                } else {
                    const cellClass = hasBench && seat.left ? "" : ` class="grey-cell"`;

                    html += `<td${cellClass}>${seat.left || ""}</td>`;

                }

            });

            html += `</tr>`;
        }

        html += `</table>`;

        html += `
        <div class="room-summary">
            <div class="summary-left">Total Number of Students: ${rooms[room].seats.length}</div>
            <div class="summary-right">${renderRoomClassCounts(rooms[room].classCounts)}</div>
        </div>
        `;

        html += `</div>`;

    });

    html += `</body></html>`;
    return html;
}

async function renderPdfFromHtml(html) {
    const launchOptions = {
        headless: "new",
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu"
        ]
    };

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    const browser = await puppeteer.launch(launchOptions);

    try {
        const page = await browser.newPage();
        await page.setJavaScriptEnabled(false);
        await page.setContent(html, { waitUntil: "networkidle0" });

        return await page.pdf({
            format: "A4",
            landscape: true,
            printBackground: true,
            margin: {
                top: "20px",
                bottom: "20px",
                left: "20px",
                right: "20px"
            }
        });
    } finally {
        await browser.close();
    }
}

async function generateHallSeatingPdfByExamId(connection, examId, examDate) {
    const rows = await buildHallSeatingRows(connection, examId);

    if (!rows.length) {
        throw new Error("No seating found");
    }

    const resolvedExamDate = await resolveHallSeatingExamDate(connection, examDate);
    const html = buildHallSeatingHtml(rows, resolvedExamDate);
    return renderPdfFromHtml(html);
}

async function buildTotalSeatingRows(connection, examId) {
    const query = `
SELECT
    s.username,
    s.branch,
    s.batch,
    s.roll_no,
    s.room_no,
    s.block
FROM Seating_allocation s
WHERE s.exam_id = ?
ORDER BY s.branch, s.batch, s.roll_no, s.block, s.room_no
`;

    const [rows] = await connection.query(query, [examId]);
    return rows;
}

function formatHallLabel(block, roomNo) {
    return [block, roomNo].filter(Boolean).join(" ").trim();
}

function compressRollNumbers(rollNumbers) {
    const uniqueSorted = [...new Set(
        rollNumbers
            .map(number => Number(number))
            .filter(number => !Number.isNaN(number))
    )].sort((a, b) => a - b);

    if (!uniqueSorted.length) {
        return "";
    }

    const ranges = [];
    let start = uniqueSorted[0];
    let end = uniqueSorted[0];

    for (let index = 1; index < uniqueSorted.length; index++) {
        const current = uniqueSorted[index];

        if (current === end + 1) {
            end = current;
            continue;
        }

        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        start = current;
        end = current;
    }

    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    return ranges.join(", ");
}

function buildTotalSeatingHtml(rows, examDate) {
    const formattedExamDate = formatExamDateForReport(examDate);
    const batchMap = new Map();
    const branchBatchCount = new Map();
    const getJoinYearFromUsername = (username) => {
        const [joinYear] = String(username || "").split("_");
        const parsedYear = parseInt(joinYear, 10);
        return Number.isNaN(parsedYear) ? null : parsedYear;
    };

    rows.forEach(row => {
        const joinYear = getJoinYearFromUsername(row.username);
        const yearLabel = joinYear ? getStudentYear(joinYear, examDate) : "";
        const branchKey = `${yearLabel}__${row.branch || ""}`;

        if (!branchBatchCount.has(branchKey)) {
            branchBatchCount.set(branchKey, new Set());
        }

        branchBatchCount.get(branchKey).add(row.batch || "");
    });

    rows.forEach(row => {
        const joinYear = getJoinYearFromUsername(row.username);
        const yearLabel = joinYear ? getStudentYear(joinYear, examDate) : "";
        const branchKey = `${yearLabel}__${row.branch || ""}`;
        const includeBatch = (branchBatchCount.get(branchKey)?.size || 0) > 1;
        const batchLabel = [yearLabel, row.branch, includeBatch ? row.batch : ""]
            .filter(Boolean)
            .join(" ")
            .trim();
        const hallLabel = formatHallLabel(row.block, row.room_no);
        const groupKey = `${batchLabel}__${hallLabel}`;

        if (!batchMap.has(groupKey)) {
            batchMap.set(groupKey, {
                batchLabel,
                hallLabel,
                rollNumbers: []
            });
        }

        batchMap.get(groupKey).rollNumbers.push(row.roll_no);
    });

    const groupedRows = [...batchMap.values()]
        .map(group => {
            const sortedRolls = group.rollNumbers
                .map(number => Number(number))
                .filter(number => !Number.isNaN(number))
                .sort((a, b) => a - b);

            return {
                batchLabel: group.batchLabel,
                hallLabel: group.hallLabel,
                minRoll: sortedRolls[0] ?? Number.MAX_SAFE_INTEGER,
                rollNumbersText: compressRollNumbers(sortedRolls),
                studentCount: sortedRolls.length
            };
        })
        .sort((a, b) =>
            a.batchLabel.localeCompare(b.batchLabel) ||
            a.minRoll - b.minRoll ||
            a.hallLabel.localeCompare(b.hallLabel)
        );

    const rowSpanMap = groupedRows.reduce((acc, row) => {
        acc[row.batchLabel] = (acc[row.batchLabel] || 0) + 1;
        return acc;
    }, {});

    let previousBatchLabel = "";

    let html = `
        <html>
        <head>
        <style>
        body{
            font-family: Arial;
            text-align:center;
        }

        .college{
            font-size:20px;
            font-weight:bold;
        }

        .exam-title,
        .report-title{
            font-size:18px;
            font-weight:bold;
            margin-top:6px;
        }

        table{
            border-collapse:collapse;
            margin:auto;
            margin-top:20px;
            width:90%;
        }

        th,td{
            border:1px solid black;
            padding:8px;
            text-align:center;
            vertical-align:middle;
        }

        th{
            background:#e6e6e6;
        }
        </style>
        </head>
        <body>
        <div class="college">ST. JOSEPH'S COLLEGE OF ENGINEERING & TECHNOLOGY, PALAI</div>
        <div class="exam-title">B.TECH INTERNAL TEST</div>
        <div class="report-title">TOTAL SEATING REPORT - ${formattedExamDate}</div>
        <table>
        <thead>
        <tr>
            <th>Batch</th>
            <th>Roll Numbers</th>
            <th>Number of Students</th>
            <th>Hall No</th>
        </tr>
        </thead>
        <tbody>
    `;

    groupedRows.forEach(row => {
        html += `<tr>`;

        if (row.batchLabel !== previousBatchLabel) {
            html += `<td rowspan="${rowSpanMap[row.batchLabel]}">${row.batchLabel}</td>`;
            previousBatchLabel = row.batchLabel;
        }

        html += `<td>${row.rollNumbersText}</td>`;
        html += `<td>${row.studentCount}</td>`;
        html += `<td>${row.hallLabel}</td>`;
        html += `</tr>`;
    });

    html += `
        </tbody>
        </table>
        </body>
        </html>
    `;

    return html;
}

async function generateTotalSeatingPdfByExamId(connection, examId, examDate) {
    const rows = await buildTotalSeatingRows(connection, examId);

    if (!rows.length) {
        throw new Error("No seating found");
    }

    const resolvedExamDate = await resolveHallSeatingExamDate(connection, examDate);
    const html = buildTotalSeatingHtml(rows, resolvedExamDate);
    return renderPdfFromHtml(html);
}

async function buildInvigilationDutyRows(connection, examDate) {
    const [rows] = await connection.query(
        `SELECT
            d.Tusername,
            t.name AS teacher_name,
            MAX(CASE WHEN UPPER(d.session) = 'FN' THEN 1 ELSE 0 END) AS has_fn,
            MAX(CASE WHEN UPPER(d.session) = 'AN' THEN 1 ELSE 0 END) AS has_an
         FROM Duty_allocation d
         JOIN Teacher t ON t.username = d.Tusername
         WHERE d.exam_date = ?
         GROUP BY d.Tusername, t.name
         ORDER BY t.name ASC, d.Tusername ASC`,
        [examDate]
    );

    return rows;
}

function buildInvigilationDutyHtml(rows, examDate, selectedYearsLabel) {
    const formattedExamDate = formatExamDateForReport(examDate);
    const titleParts = ["INVIGILATION DUTY LIST FOR"];

    if (selectedYearsLabel) {
        titleParts.push(selectedYearsLabel);
    }

    titleParts.push("INTERNAL TEST :");
    titleParts.push(formattedExamDate);

    let html = `
        <html>
        <head>
        <style>
        body{
            font-family: Arial;
            text-align:center;
        }

        .college{
            font-size:20px;
            font-weight:bold;
            margin-top:8px;
        }

        .report-title{
            font-size:18px;
            font-weight:bold;
            margin-top:18px;
        }

        table{
            border-collapse:collapse;
            margin:20px auto 0;
            width:88%;
        }

        th,td{
            border:1px solid black;
            padding:8px;
            text-align:center;
            vertical-align:middle;
        }

        th{
            background:#e6e6e6;
        }

        .name-cell{
            text-align:left;
            padding-left:12px;
        }
        </style>
        </head>
        <body>
        <div class="college">ST. JOSEPH'S COLLEGE OF ENGINEERING & TECHNOLOGY, PALAI</div>
        <div class="report-title">${titleParts.join(" ")}</div>
        <table>
            <thead>
                <tr>
                    <th>SI No</th>
                    <th>Name</th>
                    <th>FN</th>
                    <th>AN</th>
                </tr>
            </thead>
            <tbody>
    `;

    rows.forEach((row, index) => {
        html += `
            <tr>
                <td>${index + 1}</td>
                <td class="name-cell">${row.teacher_name || row.Tusername}</td>
                <td>${row.has_fn ? "D" : ""}</td>
                <td>${row.has_an ? "D" : ""}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
        </body>
        </html>
    `;

    return html;
}

async function generateInvigilationDutyPdfByExamDate(connection, examDate) {
    const rows = await buildInvigilationDutyRows(connection, examDate);

    if (!rows.length) {
        throw new Error("No duty allocation found");
    }

    const reportMeta = await getAllocationHistoryReportMeta(connection, examDate);
    const resolvedExamDate = reportMeta.exam_date || examDate;
    const selectedYearsLabel = formatSelectedYearsForReport(reportMeta.selected_years);
    const html = buildInvigilationDutyHtml(rows, resolvedExamDate, selectedYearsLabel);

    return renderPdfFromHtml(html);
}

async function getNextHallWiseReportNumber(connection) {
    const [rows] = await connection.query(
        `SELECT report_name
         FROM Reports
         WHERE report_name LIKE 'hall-wise-report%'`
    );

    const maxNumber = rows.reduce((max, row) => {
        const match = row.report_name && row.report_name.match(/hall-wise-report(\d+)$/i);
        if (!match) {
            return max;
        }
        return Math.max(max, Number(match[1]));
    }, 0);

    return maxNumber + 1;
}

async function getNextTotalSeatingReportNumber(connection) {
    const [rows] = await connection.query(
        `SELECT report_name
         FROM Reports
         WHERE report_name LIKE 'total-seating-report%'`
    );

    const maxNumber = rows.reduce((max, row) => {
        const match = row.report_name && row.report_name.match(/total-seating-report(\d+)$/i);
        if (!match) {
            return max;
        }
        return Math.max(max, Number(match[1]));
    }, 0);

    return maxNumber + 1;
}

async function getNextInvigilationDutyReportNumber(connection) {
    const [rows] = await connection.query(
        `SELECT report_name
         FROM Reports
         WHERE report_name LIKE 'invigilation-duty-report%'`
    );

    const maxNumber = rows.reduce((max, row) => {
        const match = row.report_name && row.report_name.match(/invigilation-duty-report(\d+)$/i);
        if (!match) {
            return max;
        }
        return Math.max(max, Number(match[1]));
    }, 0);

    return maxNumber + 1;
}

app.get("/api/reports", requireAuth, requireRole('admin'), async (req, res) => {
    const { examDate, reportType } = req.query;
    const filters = [];
    const params = [];

    if (examDate) {
        filters.push("exam_date = ?");
        params.push(examDate);
    }

    if (reportType) {
        filters.push("report_type = ?");
        params.push(reportType);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    try {
        const [rows] = await db.promise().query(
            `SELECT report_id, report_type, exam_date, report_name, generated_at, filepath
             FROM Reports
             ${whereClause}
             ORDER BY generated_at DESC, report_id DESC`,
            params
        );

        res.json(rows);
    } catch (error) {
        console.error("Fetch Reports Error:", error);
        res.status(500).json({ message: "Failed to fetch reports" });
    }
});

app.get("/api/reports/:reportId/download", requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const [rows] = await db.promise().query(
            `SELECT report_name, filepath FROM Reports WHERE report_id = ?`,
            [req.params.reportId]
        );

        if (!rows.length) {
            return res.status(404).json({ message: "Report not found" });
        }

        const report = rows[0];
        if (!report.filepath) {
            return res.status(404).json({ message: "Report file not found" });
        }

        const baseFileName = path.basename(report.filepath);
        const resolvedPath = path.join(generatedReportsDir, baseFileName);

        if (!fs.existsSync(resolvedPath)) {
            // Ephemeral file recovery: dynamically regenerate if missing from disk
            const connection = await db.promise().getConnection();
            try {
                let pdfBuffer = null;
                const formattedDate = safeFormatDate(report.exam_date);
                if (report.report_type === "Invigilation Duty") {
                    pdfBuffer = await generateInvigilationDutyPdfByExamDate(connection, formattedDate);
                } else {
                    const [examRows] = await connection.query(
                        "SELECT exam_id FROM Exam_schedule WHERE DATE(exam_date) = ? LIMIT 1",
                        [formattedDate]
                    );
                    if (examRows.length) {
                        if (report.report_type === "Hall-wise") {
                            pdfBuffer = await generateHallSeatingPdfByExamId(connection, examRows[0].exam_id, formattedDate);
                        } else if (report.report_type === "Total Seating") {
                            pdfBuffer = await generateTotalSeatingPdfByExamId(connection, examRows[0].exam_id, formattedDate);
                        }
                    }
                }
                if (pdfBuffer) {
                    fs.writeFileSync(resolvedPath, pdfBuffer);
                }
            } catch (regenErr) {
                console.error("Dynamic report regeneration error:", regenErr);
            } finally {
                connection.release();
            }
        }

        if (!fs.existsSync(resolvedPath)) {
            return res.status(404).json({ message: "Report file not found and could not be regenerated" });
        }

        return res.download(resolvedPath, `${report.report_name}.pdf`);
    } catch (error) {
        console.error("Download Report Error:", error);
        res.status(500).json({ message: "Failed to download report" });
    }
});

// Bulk delete reports (database records & disk files)
app.delete("/api/reports/bulk", requireAuth, requireRole('admin'), async (req, res) => {
    const { reportIds } = req.body;
    if (!Array.isArray(reportIds) || reportIds.length === 0) {
        return res.status(400).json({ message: "No reports selected for deletion" });
    }

    try {
        const [rows] = await db.promise().query(
            `SELECT filepath FROM Reports WHERE report_id IN (?)`,
            [reportIds]
        );

        for (const row of rows) {
            if (row.filepath) {
                const baseFileName = path.basename(row.filepath);
                const resolvedPath = path.join(generatedReportsDir, baseFileName);
                if (fs.existsSync(resolvedPath)) {
                    try { fs.unlinkSync(resolvedPath); } catch (e) {}
                }
            }
        }

        await db.promise().query(
            `DELETE FROM Reports WHERE report_id IN (?)`,
            [reportIds]
        );

        res.json({ message: `Successfully deleted ${reportIds.length} report(s)` });
    } catch (error) {
        console.error("Bulk Delete Reports Error:", error);
        res.status(500).json({ message: "Failed to delete reports" });
    }
});

// Single delete report
app.delete("/api/reports/:id", requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const [rows] = await db.promise().query(
            `SELECT filepath FROM Reports WHERE report_id = ?`,
            [req.params.id]
        );

        if (rows.length && rows[0].filepath) {
            const baseFileName = path.basename(rows[0].filepath);
            const resolvedPath = path.join(generatedReportsDir, baseFileName);
            if (fs.existsSync(resolvedPath)) {
                try { fs.unlinkSync(resolvedPath); } catch (e) {}
            }
        }

        await db.promise().query(`DELETE FROM Reports WHERE report_id = ?`, [req.params.id]);
        res.json({ message: "Report deleted successfully" });
    } catch (error) {
        console.error("Delete Report Error:", error);
        res.status(500).json({ message: "Failed to delete report" });
    }
});

app.get("/api/reports/hall-seating/:date", requireAuth, requireRole('admin'), async (req, res) => {
    const examDate = req.params.date;

    try {
        const [examRows] = await db.promise().query(
            `SELECT exam_id FROM Exam_schedule WHERE exam_date = ? ORDER BY exam_id DESC LIMIT 1`,
            [examDate]
        );

        if (!examRows.length) {
            return res.status(404).json({ message: "No exam found" });
        }

        const pdf = await generateHallSeatingPdfByExamId(db.promise(), examRows[0].exam_id, examDate);

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=hall_seating_${examDate}.pdf`
        });

        res.send(pdf);
    } catch (error) {
        console.error("Generate Hall Seating Report Error:", error);
        res.status(500).json({ message: error.message || "Failed to generate report" });
    }
});




// ----------------------------------------------------------------------------
//                        Student Portal
// ----------------------------------------------------------------------------


// --- API Routes ---

// 2. Get Profile
app.get('/api/student/profile', requireAuth, requireRole('student'), (req, res) => {
    db.query('SELECT * FROM Student WHERE username = ?', [req.user.username], (err, results) => {
        if (err) {
            console.error("Database Error (Profile):", err); // <--- This logs it to your terminal
            return res.status(500).json({ error: err.message });
        }
        res.json(results[0]);
    });
});

// 3. Get Seating
app.get('/api/student/seating', requireAuth, requireRole('student'), (req, res) => {
    const usernameFromToken = req.user.username;

    const query = `
        SELECT 
            sa.*, 
            es.exam_date, 
            es.subject, 
            es.sub_code
        FROM Seating_allocation sa
        LEFT JOIN Exam_schedule es ON sa.exam_id = es.exam_id
        WHERE sa.username = ?
        ORDER BY es.exam_date ASC, sa.session ASC
    `;

    db.query(query, [usernameFromToken], (err, results) => {
        if (err) {
            console.error("Database Error (Seating):", err);
            return res.status(500).json(err);
        }
        res.json(results);
    });
});

// 4. Get Exam Timetable (Joining Seating and Exam Schedule)
app.get('/api/student/exams', requireAuth, requireRole('student'), async (req, res) => {
    const username = req.user.username;

    const getSessionRank = (sessionValue) => {
        const normalized = String(sessionValue || "").trim().toUpperCase();
        if (normalized === "FN") return 1;
        if (normalized === "AN") return 2;
        if (normalized === "BOTH") return 3;
        return 4;
    };

    const normalizeExamRows = (rows, studentBranch) => {
        const studentCanonical = canonicalBranch(studentBranch);
        const seen = new Set();

        const mapped = (rows || [])
            .filter((row) => {
                // Only filter by branch — show all exam dates/sessions for the student's branch
                if (!studentCanonical) return true;
                const rowCanonical = canonicalBranch(row.branch || row.Branch || "");
                return rowCanonical === studentCanonical;
            })
            .map((row) => ({
                exam_number: row.exam_number ?? row.examNo ?? row.exam ?? row.Exam ?? null,
                subject: row.subject ?? row.Subject ?? "",
                sub_code: row.sub_code ?? row.subCode ?? row.code ?? row.Code ?? "",
                exam_date: row.exam_date ?? row.examDate ?? row.date ?? row.Date ?? null,
                session: row.session ?? row.Session ?? "",
                year: row.year ?? null
            }))
            .filter((row) => row.exam_date && row.session && (row.subject || row.sub_code))
            .filter((row) => {
                const key = `${row.exam_date}__${row.session}__${row.sub_code}__${row.subject}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

        mapped.sort((a, b) => {
            const dateDiff = new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime();
            if (dateDiff !== 0) return dateDiff;
            return getSessionRank(a.session) - getSessionRank(b.session);
        });

        return mapped;
    };


    try {
        const [profileRows] = await db.promise().query(
            'SELECT * FROM Student WHERE username = ? LIMIT 1',
            [username]
        );

        if (!profileRows.length) {
            return res.json([]);
        }

        const student = profileRows[0] || {};
        const studentBranch = String(student.branch || student.Branch || "").trim();

        // Dynamically compute student's academic year based on latest join year in the system
        const [[maxRow]] = await db.promise().query('SELECT MAX(year_of_join) AS maxYear FROM Student');
        const baseYear = (maxRow && maxRow.maxYear) ? Number(maxRow.maxYear) : new Date().getFullYear();
        const joinYear = Number(student.year_of_join || student.yearOfJoin || student.join_year || 0);
        const fallbackAcademicYear = (Number.isFinite(joinYear) && joinYear > 0) ? (baseYear - joinYear + 1) : 0;
        const studentYear = Number(student.year || student.academic_year || student.academicYear || fallbackAcademicYear || 0);

        let examRows = [];
        try {
            const [rows] = await db.promise().query('SELECT * FROM Exam_schedule');
            examRows = rows;
        } catch (tblErr) {
            if (tblErr.code === 'ER_NO_SUCH_TABLE') {
                const [fallbackRows] = await db.promise().query('SELECT * FROM exam_schedule');
                examRows = fallbackRows;
            } else {
                throw tblErr;
            }
        }

        return res.json(normalizeExamRows(examRows, studentBranch));
    } catch (err) {
        console.error("Database Error (Student Exams):", err);
        return res.status(500).json({ error: "Failed to fetch timetable" });
    }
});

/* -------------------------------------------------------------------------- */
app.get('/api/teacher/dashboard', requireAuth, requireRole('teacher'), (req, res) => {
    const user = req.user;

    const teacherQuery = `
        SELECT username, name
        FROM Teacher
        WHERE username = ?
        LIMIT 1
    `;

    const dutyQuery = `
        SELECT 
            d.exam_date,
            d.session,
            CONCAT(d.block, ' ', d.room_no) AS exam_hall
        FROM Duty_allocation d
        WHERE d.Tusername = ?
        ORDER BY d.exam_date ASC,
                 FIELD(d.session, 'FN', 'AN', 'Both'),
                 d.block ASC,
                 d.room_no ASC
    `;

    db.query(teacherQuery, [user.username], (teacherErr, teacherResults) => {
        if (teacherErr) {
            console.error('Teacher lookup failed:', teacherErr);
            return res.status(500).json({ message: 'Failed to fetch teacher details' });
        }

        if (!teacherResults.length) {
            return res.status(404).json({ message: 'Teacher not found' });
        }

        db.query(dutyQuery, [user.username], (dutyErr, dutyResults) => {
            if (dutyErr) {
                console.error('Teacher duties lookup failed:', dutyErr);
                return res.status(500).json({ message: 'Failed to fetch duty schedule' });
            }

            return res.json({
                teacher: teacherResults[0],
                duties: dutyResults
            });
        });
    });
});

app.post('/api/teacher/unavailability', requireAuth, requireRole('teacher'), (req, res) => {
    const user = req.user;
    const examDate = String(req.body.examDate || '').trim();
    const session = String(req.body.session || '').trim();
    const reason = String(req.body.reason || '').trim();
    const reasonWordCount = reason ? reason.split(/\s+/).filter(Boolean).length : 0;

    if (!examDate || !session || !reason) {
        return res.status(400).json({ message: 'Exam date, session, and reason are required.' });
    }

    if (!['FN', 'AN', 'Both'].includes(session)) {
        return res.status(400).json({ message: 'Invalid session selected.' });
    }

    if (reasonWordCount > 40) {
        return res.status(400).json({ message: 'Reason too long make it shorter' });
    }

    ensureRequestTables().then(() => {
        db.query(
            `INSERT INTO teacher_unavailability (Tusername, exam_date, session, reason)
             VALUES (?, ?, ?, ?)`,
            [user.username, examDate, session, reason],
            (err, result) => {
                if (err) {
                    console.error('Failed to save teacher unavailability:', err);
                    return res.status(500).json({ message: 'Failed to save unavailability request.' });
                }

                return res.json({
                    message: 'Unavailability request submitted successfully.',
                    unavailabilityId: result.insertId
                });
            }
        );
    }).catch((error) => {
        console.error('Failed to prepare teacher unavailability tables:', error);
        return res.status(500).json({ message: 'Failed to prepare unavailability storage.' });
    });
});

app.get('/api/admin/requests/unread-count', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        await ensureRequestTables();

        const [[stateRow]] = await db.promise().query(
            `SELECT last_seen_unavailability_id
             FROM admin_request_state
             WHERE state_id = 1`
        );

        const lastSeenId = Number(stateRow?.last_seen_unavailability_id || 0);
        const [[countRow]] = await db.promise().query(
            `SELECT COUNT(*) AS unreadCount
             FROM teacher_unavailability
             WHERE unavailability_id > ?`,
            [lastSeenId]
        );

        const [[totalRow]] = await db.promise().query(
            `SELECT COUNT(*) AS pendingCount
             FROM teacher_unavailability`
        );

        res.json({
            unreadCount: Number(countRow.unreadCount || 0),
            pendingCount: Number(totalRow.pendingCount || 0)
        });
    } catch (error) {
        console.error('Failed to fetch unread request count:', error);
        res.status(500).json({ message: 'Failed to fetch unread request count.' });
    }
});

app.post('/api/admin/requests/mark-read', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        await ensureRequestTables();

        const [[maxRow]] = await db.promise().query(
            `SELECT COALESCE(MAX(unavailability_id), 0) AS maxId
             FROM teacher_unavailability`
        );

        await db.promise().query(
            `UPDATE admin_request_state
             SET last_seen_unavailability_id = ?
             WHERE state_id = 1`,
            [Number(maxRow.maxId || 0)]
        );

        res.json({ message: 'Requests marked as read.' });
    } catch (error) {
        console.error('Failed to mark requests as read:', error);
        res.status(500).json({ message: 'Failed to mark requests as read.' });
    }
});

app.get('/api/admin/requests', requireAuth, requireRole('admin'), (req, res) => {
    ensureRequestTables().then(() => {
        db.query(
            `SELECT
                tu.unavailability_id,
                tu.Tusername,
                t.name AS teacher_name,
                t.availability,
                tu.exam_date,
                tu.session,
                tu.reason
             FROM teacher_unavailability tu
             LEFT JOIN Teacher t ON t.username = tu.Tusername
             ORDER BY tu.unavailability_id DESC`,
            (err, results) => {
                if (err) {
                    console.error('Failed to fetch admin requests:', err);
                    return res.status(500).json({ message: 'Failed to fetch requests.' });
                }

                return res.json(results);
            }
        );
    }).catch((error) => {
        console.error('Failed to prepare admin request tables:', error);
        return res.status(500).json({ message: 'Failed to prepare requests data.' });
    });
});

app.post('/api/admin/requests/:id/decision', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        await ensureRequestTables();

        const requestId = Number(req.params.id);
        const decision = String(req.body.decision || '').trim().toLowerCase();

        if (!Number.isInteger(requestId) || requestId <= 0) {
            return res.status(400).json({ message: 'Invalid request id.' });
        }

        if (!['accept', 'reject'].includes(decision)) {
            return res.status(400).json({ message: 'Invalid decision.' });
        }

        const [[requestRow]] = await db.promise().query(
            `SELECT Tusername
             FROM teacher_unavailability
             WHERE unavailability_id = ?`,
            [requestId]
        );

        if (!requestRow) {
            return res.status(404).json({ message: 'Request not found.' });
        }

        const updatedAvailability = decision === 'accept' ? 'No' : 'Yes';

        await db.promise().query(
            `UPDATE Teacher
             SET availability = ?
             WHERE username = ?`,
            [updatedAvailability, requestRow.Tusername]
        );

        await db.promise().query(
            `DELETE FROM teacher_unavailability
             WHERE unavailability_id = ?`,
            [requestId]
        );

        return res.json({
            message: `Teacher availability updated to ${updatedAvailability}.`,
            availability: updatedAvailability,
            username: requestRow.Tusername,
            removedRequestId: requestId
        });
    } catch (error) {
        console.error('Failed to update request decision:', error);
        return res.status(500).json({ message: 'Failed to update teacher availability.' });
    }
});




///* -------------------------------------------------------------------------- */
/* FACULTY DUTY ALLOCATION ROUTES                      */
/* -------------------------------------------------------------------------- */

// 1. GET: Fetch duty summary
app.get('/api/duties/summary', requireAuth, requireRole('admin'), async (req, res) => {
    let { date, session } = req.query;
    const formattedDate = safeFormatDate(date);
    if (!formattedDate || !session) return res.status(400).json({ error: "Missing or invalid date or session" });

    try {
        let required = 0;
        let hasAllocation = false;

        // Query 1: Get rooms from Allocation_History first
        const [roomResults] = await db.promise().query(
            `SELECT selected_rooms FROM Allocation_History WHERE DATE(exam_date) = ? AND session = ? ORDER BY updated_at DESC LIMIT 1`,
            [formattedDate, session]
        );

        if (roomResults.length > 0 && roomResults[0].selected_rooms) {
            try {
                const rooms = JSON.parse(roomResults[0].selected_rooms);
                if (Array.isArray(rooms) && rooms.length > 0) {
                    required = rooms.length;
                    hasAllocation = true;
                }
            } catch (e) {
                console.error("Error parsing rooms:", e);
            }
        }

        // Fallback: If not in Allocation_History, check Seating_allocation directly
        if (!hasAllocation) {
            const [seatRooms] = await db.promise().query(`
                SELECT DISTINCT CONCAT(sa.block, sa.room_no) as roomFull
                FROM Seating_allocation sa
                JOIN Exam_schedule es ON es.exam_id = sa.exam_id
                WHERE DATE(es.exam_date) = ? AND (es.session = ? OR sa.session = ?)
            `, [formattedDate, session, session]);

            if (seatRooms.length > 0) {
                required = seatRooms.length;
                hasAllocation = true;
            }
        }

        // Query 2: Get available teachers (Must have duty_count > 0 and availability YES)
        const [[teacherResult]] = await db.promise().query(
            `SELECT COUNT(*) as availableCount FROM Teacher WHERE UPPER(availability) = 'YES' AND duty_count > 0`
        );

        // Query 3: Check if duties are already generated for this exact slot
        const [[dutyResult]] = await db.promise().query(
            `SELECT COUNT(*) as dutyCount FROM Duty_allocation WHERE DATE(exam_date) = ? AND session = ?`,
            [formattedDate, session]
        );

        res.json({
            required,
            available: Number(teacherResult?.availableCount || 0),
            hasAllocation,
            isGenerated: Number(dutyResult?.dutyCount || 0) > 0
        });
    } catch (err) {
        console.error("Duties summary error:", err);
        res.status(500).json({ error: "Duty summary check failed", details: err.message });
    }
});

// 2. POST: Generate Duties with Fair Workload Balancing
app.post('/api/duties/generate', requireAuth, requireRole('admin'), async (req, res) => {
    const { date, session } = req.body;
    const formattedDate = safeFormatDate(date);
    if (!formattedDate || !session) {
        return res.status(400).json({ message: "Valid date and session are required." });
    }
    const slotKey = getDutySlotKey(formattedDate, session);

    const connection = await db.promise().getConnection();
    try {
        await connection.beginTransaction();

        // A. Verify Exam Schedule exists
        const [exams] = await connection.query(
            `SELECT exam_id FROM Exam_schedule WHERE exam_date = ? AND session = ? LIMIT 1`, 
            [formattedDate, session]
        );
        if (!exams.length) throw new Error("No Exam Schedule found for this slot.");
        const exam_id = exams[0].exam_id;

        // B. Get the list of rooms allocated for this exam
        let selectedRooms = [];
        const [alloc] = await connection.query(
            `SELECT selected_rooms FROM Allocation_History WHERE exam_date = ? AND session = ?`, 
            [formattedDate, session]
        );

        if (alloc.length > 0 && alloc[0].selected_rooms) {
            try {
                selectedRooms = JSON.parse(alloc[0].selected_rooms);
            } catch (e) {}
        }

        // Fallback: check Seating_allocation if Allocation_History was missing
        if (!selectedRooms.length) {
            const [seatRooms] = await connection.query(`
                SELECT DISTINCT CONCAT(sa.block, sa.room_no) as roomFull
                FROM Seating_allocation sa
                JOIN Exam_schedule es ON es.exam_id = sa.exam_id
                WHERE es.exam_date = ? AND (es.session = ? OR sa.session = ?)
            `, [formattedDate, session, session]);
            selectedRooms = seatRooms.map(r => r.roomFull);
        }

        if (!selectedRooms.length) {
            throw new Error("No Seating Allocation found. Please generate seating first.");
        }

        // C. WORKLOAD RESTORE: If re-generating, give points back to previously assigned teachers for this slot
        const [prevDuties] = await connection.query(
            `SELECT Tusername FROM Duty_allocation WHERE exam_date = ? AND session = ?`,
            [formattedDate, session]
        );
        const previousUsernames = prevDuties.map(d => d.Tusername).filter(Boolean);
        if (previousUsernames.length > 0) {
            await connection.query(
                `UPDATE Teacher SET duty_count = duty_count + 1 WHERE username IN (?)`,
                [previousUsernames]
            );
            await connection.query(
                `DELETE FROM Duty_allocation WHERE exam_date = ? AND session = ?`,
                [formattedDate, session]
            );
        }

        // D. Pick teachers by workload priority and randomize inside the same workload band.
        const [teachers] = await connection.query(
            `SELECT username FROM Teacher 
             WHERE UPPER(availability) = 'YES' AND duty_count > 0 
             ORDER BY duty_count DESC, RAND()`
        );

        if (teachers.length < selectedRooms.length) {
            throw new Error(`Staff Shortage: Need ${selectedRooms.length}, but only have ${teachers.length} available.`);
        }

        const recentUsernames = previousUsernames.length
            ? previousUsernames
            : (recentDutyAssignments.get(slotKey) || []);

        let teacherPool = teachers;
        if (recentUsernames.length > 0) {
            const recentSet = new Set(recentUsernames);
            const freshTeachers = teachers.filter(teacher => !recentSet.has(teacher.username));
            if (freshTeachers.length >= selectedRooms.length) {
                teacherPool = freshTeachers;
            }
        }

        // E. Map teachers to rooms and prepare for bulk insert
        const assignedUsernames = [];
        const dutyValues = selectedRooms.map((roomFull, index) => {
            const blockMatch = roomFull.match(/[A-Za-z]+/);
            const roomMatch = roomFull.match(/\d+/);
            const block = blockMatch ? blockMatch[0] : "";
            const room_no = roomMatch ? roomMatch[0] : "";
            const tUser = teacherPool[index].username;
            assignedUsernames.push(tUser);
            return [exam_id, room_no, block, tUser, formattedDate, session];
        });

        // F. Finalize: Save assignments and decrement duty points
        await connection.query(
            `INSERT INTO Duty_allocation (exam_id, room_no, block, Tusername, exam_date, session) VALUES ?`,
            [dutyValues]
        );

        await connection.query(
            `UPDATE Teacher SET duty_count = duty_count - 1 WHERE username IN (?)`,
            [assignedUsernames]
        );

        const invigilationDutyPdfBuffer = await generateInvigilationDutyPdfByExamDate(connection, formattedDate);
        const nextInvigilationDutyReportNumber = await getNextInvigilationDutyReportNumber(connection);
        const invigilationDutyReportName = `invigilation-duty-report${nextInvigilationDutyReportNumber}`;
        const invigilationDutyFilePath = path.join(
            generatedReportsDir,
            `${invigilationDutyReportName}.pdf`
        );

        fs.writeFileSync(invigilationDutyFilePath, invigilationDutyPdfBuffer);

        const [[reportIdRow]] = await connection.query(
            `SELECT COALESCE(MAX(report_id), 0) + 1 AS nextReportId FROM Reports`
        );

        await connection.query(
            `INSERT INTO Reports (report_id, report_type, exam_date, report_name, filepath)
             VALUES (?, ?, ?, ?, ?)`,
            [
                reportIdRow.nextReportId,
                "Invigilation Duty",
                formattedDate,
                invigilationDutyReportName,
                `${invigilationDutyReportName}.pdf`
            ]
        );

        await connection.commit();
        recentDutyAssignments.set(slotKey, assignedUsernames);
        res.json({
            message: "Duties generated successfully with workload balancing.",
            reportName: invigilationDutyReportName
        });

    } catch (err) {
        await connection.rollback();
        console.error("Generate duties error:", err);
        res.status(500).json({ message: err.message });
    } finally {
        connection.release();
    }
});

// 3. GET: Fetch the assigned duty list for the table
app.get('/api/duties/list', requireAuth, requireRole('admin'), (req, res) => {
    const { date, session } = req.query;
    const formattedDate = safeFormatDate(date);
    if (!formattedDate || !session) return res.status(400).json({ error: "Valid date and session are required" });

    const query = `
        SELECT d.room_no, d.block, d.Tusername, t.name as teacher_name
        FROM Duty_allocation d
        LEFT JOIN Teacher t ON d.Tusername = t.username
        WHERE DATE(d.exam_date) = ? AND d.session = ?
        ORDER BY d.block ASC, d.room_no ASC
    `;
    db.query(query, [formattedDate, session], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// 4. GET: Helper for Calendar highlighting (Unique Exam Dates)
app.get('/api/exam-dates-only', requireAuth, requireRole('admin'), (req, res) => {
    const query = 'SELECT DISTINCT exam_date FROM Exam_schedule ORDER BY exam_date ASC';
    db.query(query, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// 4b. GET: Exam Status Board data (slot-wise seating + duty status)
app.get('/api/exam-status-board', requireAuth, requireRole('admin'), (req, res) => {
    const query = `
        SELECT
            DATE_FORMAT(slots.exam_date, '%Y-%m-%d') AS exam_date,
            slots.session,
            CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM Seating_allocation sa
                    JOIN Exam_schedule es2 ON es2.exam_id = sa.exam_id
                    WHERE es2.exam_date = slots.exam_date
                      AND (es2.session = slots.session OR sa.session = slots.session)
                ) OR EXISTS (
                    SELECT 1
                    FROM Allocation_History ah
                    WHERE ah.exam_date = slots.exam_date
                      AND ah.session = slots.session
                ) THEN 1
                ELSE 0
            END AS seating_done,
            CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM Duty_allocation da
                    WHERE da.exam_date = slots.exam_date
                      AND da.session = slots.session
                ) THEN 1
                ELSE 0
            END AS duty_done
        FROM (
            SELECT DISTINCT exam_date, session
            FROM Exam_schedule
        ) AS slots
        ORDER BY slots.exam_date ASC,
                 CASE slots.session
                    WHEN 'FN' THEN 1
                    WHEN 'AN' THEN 2
                    ELSE 3
                 END ASC
    `;

    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 5. DELETE: Remove duty allocation and RESTORE points
app.delete('/api/duties/delete', requireAuth, requireRole('admin'), async (req, res) => {
    const { date, session } = req.body;
    const formattedDate = safeFormatDate(date);
    if (!formattedDate || !session) return res.status(400).json({ message: "Valid date and session are required." });
    const slotKey = getDutySlotKey(formattedDate, session);

    const connection = await db.promise().getConnection();
    try {
        await connection.beginTransaction();

        // Find teachers assigned to this specific slot
        const [prevDuties] = await connection.query(
            `SELECT Tusername FROM Duty_allocation WHERE exam_date = ? AND session = ?`,
            [formattedDate, session]
        );

        if (prevDuties.length > 0) {
            const usernames = prevDuties.map(d => d.Tusername).filter(Boolean);
            recentDutyAssignments.set(slotKey, usernames);
            
            // 1. Give points back
            if (usernames.length > 0) {
                await connection.query(
                    `UPDATE Teacher SET duty_count = duty_count + 1 WHERE username IN (?)`,
                    [usernames]
                );
            }

            // 2. Delete the actual duties
            await connection.query(
                `DELETE FROM Duty_allocation WHERE exam_date = ? AND session = ?`,
                [formattedDate, session]
            );
        }

        await connection.commit();
        res.json({ message: "Allocation deleted and faculty points restored." });
    } catch (err) {
        await connection.rollback();
        console.error("Delete duties error:", err);
        res.status(500).json({ message: err.message });
    } finally {
        connection.release();
    }
});
/* -------------------------------------------------------------------------- */
/* SERVER START & ERROR HANDLING               */
/* -------------------------------------------------------------------------- */

// Serve static frontend build in production if present (monolithic / container deployment)
const frontendBuildPath = path.join(__dirname, "../frontend/build");
if (fs.existsSync(frontendBuildPath)) {
    app.use(express.static(frontendBuildPath));
    app.get("/{*any}", (req, res, next) => {
        if (req.path.startsWith("/api/")) {
            return next();
        }
        res.sendFile(path.join(frontendBuildPath, "index.html"));
    });
}

// 404 Catch-All Handler
app.use((req, res) => {
    res.status(404).json({ message: "API endpoint not found" });
});

// Centralized Error Handler
app.use((err, req, res, next) => {
    console.error("Unhandled Server Error:", err);
    res.status(err.status || 500).json({
        message: process.env.NODE_ENV === "production" ? "Internal server error" : (err.message || "Internal server error")
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log("-------------------------------------------");
    console.log(` Server running on http://0.0.0.0:${PORT} `);
    console.log(` Health check at http://0.0.0.0:${PORT}/api/health `);
    console.log("-------------------------------------------");
});
