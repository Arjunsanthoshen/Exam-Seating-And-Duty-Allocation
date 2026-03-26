const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const SECRET_KEY = "my_super_secret_key";

const BCRYPT_HASH_PREFIX = /^\$2[aby]\$\d{2}\$/;


const app = express();

/* -------------------------------------------------------------------------- */
/* MIDDLEWARE                                 */
/* -------------------------------------------------------------------------- */

app.use(cors());
app.use(express.json());
app.use(express.json());

/* -------------------------------------------------------------------------- */
/* DATABASE CONNECTION                             */
/*                              FILE UPLOAD SETUP                             */
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
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

const generatedReportsDir = path.join(__dirname, "generated_reports");
if (!fs.existsSync(generatedReportsDir)) {
    fs.mkdirSync(generatedReportsDir, { recursive: true });
}
/* -------------------------------------------------------------------------- */
/*                            DATABASE CONNECTION                             */
/* -------------------------------------------------------------------------- */
const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "tree",
    database: "college",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test connection
db.getConnection((err, connection) => {
    if (err) {
        console.error("Database connection failed:", err);
    } else {
        console.log("Connected to MySQL successfully!");
        connection.release(); // VERY IMPORTANT
    }
});

const recentDutyAssignments = new Map();

function getDutySlotKey(date, session) {
    return `${date}_${session}`;}

function verifyRequestToken(req, res, expectedRole) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        res.status(401).json({ message: "No token provided" });
        return null;
    }

    try {
        const user = jwt.verify(token, SECRET_KEY);

        if (expectedRole && String(user.role || '').toLowerCase() !== String(expectedRole).toLowerCase()) {
            res.status(403).json({ message: `Role must be '${expectedRole}'` });
            return null;
        }

        return user;
    } catch (error) {
        res.status(403).json({ message: "Invalid token" });
        return null;
    }
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
/* STUDENT MANAGEMENT ROUTES                           */
/* -------------------------------------------------------------------------- */
app.get('/api/students', (req, res) => {

    const query = `
        SELECT year_of_join, branch, batch, end_serial
        FROM Student_manage 
        ORDER BY year_of_join DESC, branch ASC, batch ASC
    `;

    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);

    });

});

// POST: Add new
app.post('/api/students/add', (req, res) => {
    const { year, branch, batch, strength } = req.body;

    const insertQuery = `
        INSERT INTO Student_manage 
        (year_of_join, branch, batch, end_serial) 
        VALUES (?, ?, ?, ?)
    `;

    db.query(insertQuery, [year, branch, batch, strength], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Duplicate entry or database error" });
        }
        res.status(200).json({ message: 'Saved successfully' });
    });

});

// PUT: Update
app.put('/api/students/update', (req, res) => {

    const { year, branch, strength } = req.body;


    const query = `
        UPDATE Student_manage 
        SET end_serial = ? 
        WHERE year_of_join = ? AND branch = ?
    `;

    db.query(query, [strength, year, branch], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Updated successfully" });
    });
});

// DELETE: Remove
app.delete('/api/students/:year/:branch/:batch', (req, res) => {
    const { year, branch, batch } = req.params;

    db.query(
        `DELETE FROM Student_manage 
         WHERE year_of_join = ? AND branch = ? AND batch = ?`,
        [year, branch, batch],
        (err) => {
            if (err) return res.status(500).json(err);
            res.json({ message: "Deleted successfully" });
        }
    );
});

/* -------------------------------------------------------------------------- */
/* MANAGE ROOMS ROUTES                            */
/* -------------------------------------------------------------------------- */

app.get('/api/rooms', (req, res) => {
    db.query('SELECT * FROM Rooms ORDER BY block ASC, room_no ASC',
        (err, results) => {
            if (err) return res.status(500).json(err);
            res.json(results);
        });
});


// DELETE: Remove a room
app.delete('/api/rooms/:block/:room_no', (req, res) => {
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
app.get('/api/blocks', (req, res) => {
    db.query('SELECT block_name FROM blocks ORDER BY block_name ASC', (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// POST: Add a new block
app.post('/api/blocks', (req, res) => {
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
app.delete('/api/blocks/:name', (req, res) => {
    const blockName = req.params.name;
    db.query('DELETE FROM blocks WHERE block_name = ?', [blockName], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Block deleted successfully" });
    });
});

// POST: Add or update a room
app.post('/api/rooms', (req, res) => {
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
/* MANAGE TEACHERS ROUTES                           */
/* -------------------------------------------------------------------------- */

app.get('/api/teachers', (req, res) => {
    db.query(`
        SELECT username, name, availability, department, phone 
        FROM Teacher 
        ORDER BY name ASC
    `, (err, results) => {
        if (err) return res.status(500).json({ error: "Database fetch failed" });
        res.json(results);
    });
});

app.post('/api/teachers', async (req, res) => {
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

app.delete('/api/teachers/:username', (req, res) => {
    db.query("DELETE FROM Users WHERE username = ?",
        [req.params.username],
        (err) => {
            if (err) return res.status(500).json(err);
            res.json({ message: "Teacher deleted successfully" });
        });
});

app.put('/api/teachers/availability', (req, res) => {
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
/* EXAM SCHEDULE ROUTES                             */
/* -------------------------------------------------------------------------- */

// GET ALL: Updated to select all columns including sub_code
/*                         TEACHER EXCEL UPLOAD ROUTE                         */
/* -------------------------------------------------------------------------- */

app.get("/api/teachers/template", (req, res) => {
    const templatePath = path.join(__dirname, "teacher_template1.xlsx");

    if (!fs.existsSync(templatePath)) {
        return res.status(404).json({ message: "Teacher template file not found" });
    }

    return res.download(templatePath, "teacher_template1.xlsx");
});

app.post("/api/teachers/upload-excel", upload.single("file"), async (req, res) => {

    console.log("Excel upload request received");

    try {

        if (!req.file) {
            console.log("No file uploaded");
            return res.status(400).json({ message: "No file uploaded" });
        }

        console.log("Uploaded file:", req.file.filename);

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

        fs.unlink(req.file.path, () => {});
        if (processedCount === 0) {
            return res.status(400).json({
                message: "No valid rows found in Excel",
                hint: "Required Excel order: username, name, department, phone"
            });
        }
        res.json({ message: `Teachers uploaded successfully (${processedCount} rows)` });

    } catch (error) {

        console.error(error);
        res.status(500).json({
            message: "Excel upload failed",
            error: error?.message || "Unknown server error"
        });

    }

});
/* -------------------------------------------------------------------------- */
/*                          EXAM SCHEDULE ROUTES                              */
/* -------------------------------------------------------------------------- */


// GET ALL EXAMS
app.get('/api/exam-schedule', (req, res) => {

    const query = `
        SELECT * FROM exam_schedule
        ORDER BY exam_date DESC, year ASC
        SELECT *
        FROM exam_schedule
        ORDER BY exam_date ASC, session ASC, branch ASC
    `;

    db.query(query, (err, results) => {

        if (err)
            return res.status(500).json(err);

        res.json(results);

    });

});

// ADD: Updated to handle nested object structure {name, code} and batch insert


// ADD EXAM
app.post('/api/exam-schedule/add', (req, res) => {

    // Filter branches where at least a name is entered, then map to SQL array
    const values = Object.entries(subjects)
        .filter(([_, sub]) => sub.name && sub.name.trim() !== "")
        .map(([branch, sub]) =>
            [year, examNumber, date, session, branch, sub.name, sub.code]
        );
    const {
        year,
        exam_date,
        session,
        branch,
        subject,
        sub_code
    } = req.body;


    const query = `
        INSERT INTO exam_schedule
        (year, exam_number, exam_date, session, branch, subject, sub_code)
        VALUES ?
    `;

    db.query(query, [values], (err) => {
        if (err) {
            console.error("SQL ADD Error:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: "Schedule saved successfully" });
    });
});

// UPDATE: Updated to handle single branch update with sub_code
app.post('/api/exam-schedule/update/:id', (req, res) => {
    const { year, date, session, subjects, examNumber } = req.body;

    // Find the branch currently in the state (Update mode usually handles one branch)
    const branch = Object.keys(subjects).find(b => subjects[b].name !== "");
    const subjectData = subjects[branch];

    const query = `
        UPDATE exam_schedule
        SET year=?, exam_number=?, exam_date=?, session=?, branch=?, subject=?, sub_code=?
        (year, exam_date, session, branch, subject, sub_code)
        VALUES (?, ?, ?, ?, ?, ?)
    `;


    db.query(query,

        [
            year,
            exam_date,
            session,
            branch,
            subject,
            sub_code
        ],

        (err) => {

            if (err) {

                console.log(err);

                return res.status(500).json({
                    message: "Error saving exam schedule"
                });

            }

            res.json({
                message: "Exam schedule added successfully"
            });

        });

});



// UPDATE EXAM
app.put('/api/exam-schedule/update/:id', (req, res) => {

    const {
        year,
        exam_date,
        session,
        branch,
        subject,
        sub_code
    } = req.body;


    const query = `
        UPDATE exam_schedule
        SET
        year=?,
        exam_date=?,
        session=?,
        branch=?,
        subject=?,
        sub_code=?
        WHERE exam_id=?
    `;


    db.query(query,
        [year, examNumber, date, session, branch, subjectData.name, subjectData.code, req.params.id],
        (err) => {
            if (err) {
                console.error("SQL UPDATE Error:", err.message);
                return res.status(500).json(err);
            }
            res.json({ message: "Updated successfully" });
        }
    );

        [
            year,
            exam_date,
            session,
            branch,
            subject,
            sub_code,
            req.params.id
        ],

        (err) => {

            if (err)
                return res.status(500).json(err);

            res.json({
                message: "Exam schedule updated successfully"
            });

        };

});



// DELETE EXAM
app.delete('/api/exam-schedule/:id', (req, res) => {
    db.query(
        'DELETE FROM exam_schedule WHERE exam_id = ?',
        [req.params.id],
        (err) => {
            if (err) return res.status(500).json(err);
            res.json({ message: "Deleted successfully" });
        }
    );


    const query =
        `DELETE FROM exam_schedule WHERE exam_id=?`;


    db.query(query,

        [req.params.id],

        (err) => {

            if (err)
                return res.status(500).json(err);

            res.json({
                message: "Exam deleted successfully"
            });

        });

});
/* -------------------------------------------------------------------------- */
/* LOGIN ROUTES                                */
/* -------------------------------------------------------------------------- */

app.post("/api/login", (req, res) => {

    const usernameInput = String(req.body.username || "");
    const passwordInput = String(req.body.password || "");
    const roleInput = String(req.body.role || "");

    const username = usernameInput.trim();
    const role = roleInput.trim();

    const query = `
        SELECT * FROM Users
        WHERE LOWER(TRIM(username)) = LOWER(?)
          AND LOWER(TRIM(role)) = LOWER(?)
        LIMIT 1
    `;

    db.query(query, [username, role], async (err, results) => {

        if (err)
            return res.status(500).json({ message: "Server error" });

        if (results.length === 0)
            return res.status(401).json({ message: "User not found" });

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
            return res.status(401).json({ message: "Incorrect password" });

        const token = jwt.sign(
            { username: user.username, role: user.role },
            SECRET_KEY,
            { expiresIn: "2h" }
        );

        res.json({
            success: true,
            role: user.role,
            token: token
        });

    });

});

app.post("/api/teacher/change-password", async (req, res) => {
    const user = verifyRequestToken(req, res, "teacher");
    if (!user) {
        return;
    }

    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");
    const confirmPassword = String(req.body.confirmPassword || "");

    if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ message: "All password fields are required" });
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

app.post("/api/signup", async (req, res) => {

    const { username, password, role } = req.body;

    try {

        const hashedPassword = await bcrypt.hash(password, 10);

        const query = `
        INSERT INTO Users (username, role, password)
        VALUES (?, ?, ?)
        `;

        db.query(query, [username, role, hashedPassword], (err) => {

            if (err)
                return res.status(500).json({
                    message: "Username already exists"
                });

            res.json({
                message: "User created successfully"
            });

        });

    } catch (error) {

        res.status(500).json({
            message: "Server error"
        });

    }

});



// ----------------------------------------------------------------------------
//                         SEATING ALLOCATION ROUTES
// ----------------------------------------------------------------------------

// GET: Fetch required data for the Allocation page
app.get('/api/allocation/init', async (req, res) => {
    try {
        // Fetch rooms for the toggle list
        const [rooms] = await db.promise().query('SELECT block, room_no, capacity FROM Rooms ORDER BY block, room_no');
        
        // Fetch student counts grouped by join year
        const currentYear = new Date().getFullYear();
        const [students] = await db.promise().query(`
            SELECT 
                (${currentYear} - year_of_join + 1) AS academic_year,
                SUM(end_serial) as total_students
            FROM Student_manage 
            GROUP BY year_of_join
        `);
        
        const formattedStudents = students.map(s => ({
            academic_year: Number(s.academic_year),
            total_students: Number(s.total_students)
        }));

        res.json({ rooms, students: formattedStudents });
    } catch (err) {
        console.error("Allocation Init Error:", err);
        res.status(500).json({ error: "Database fetch failed" });
    }
});


// POST: Generate Allocation
app.post('/api/allocation/generate', async (req, res) => {
    const { examDate, session, selectedYears, selectedRooms } = req.body;

    if (!examDate || !session || !selectedYears?.length || !selectedRooms?.length) {
        return res.status(400).json({ message: "Missing required fields." });
    }

    const connection = await db.promise().getConnection();

    await connection.query("DELETE FROM Seating_allocation");

    try {
        await connection.beginTransaction();

        // 1️⃣ Fetch Exam
        const [examRows] = await connection.query(
            `SELECT exam_id FROM Exam_schedule
             WHERE exam_date = ? AND session = ?`,
            [examDate, session]
        );

        if (!examRows.length) {
            await connection.rollback();
            return res.status(400).json({ message: "No exam found." });
        }

        const exam_id = examRows[0].exam_id;

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
        const currentYear = new Date().getFullYear();
        const joinYears = selectedYears.map(y =>
            currentYear - Number(y) + 1
        );

        // 4️⃣ Fetch Students
        const [studentRows] = await connection.query(
            `SELECT year_of_join, branch, batch, end_serial
             FROM Student_manage
             WHERE year_of_join IN (?)
             ORDER BY year_of_join ASC, branch ASC, batch ASC`,
            [joinYears]
        );

        if (!studentRows.length) {
            await connection.rollback();
            return res.status(400).json({ message: "No students found." });
        }

        // 5️⃣ Build Year Queues
        const yearQueues = {};
        studentRows.forEach(row => {
            if (!yearQueues[row.year_of_join])
                yearQueues[row.year_of_join] = [];

            for (let i = 1; i <= row.end_serial; i++) {
                yearQueues[row.year_of_join].push({
                    username: `${row.year_of_join}_${row.branch}_${row.batch}_${i}`,
                    branch: row.branch,
                    batch: row.batch,
                    roll_no: i,
                    year: row.year_of_join
                });
            }
        });

        const yearList = Object.keys(yearQueues).sort();

        await connection.query(
            `DELETE FROM Seating_allocation WHERE exam_id = ?`,
            [exam_id]
        );

        let seating_id = 1;
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

                        await connection.query(
                            `INSERT INTO Seating_allocation
                            (seating_id, exam_id, room_no, block,
                             column_no, bench_no, seat_position,
                             username, batch, roll_no, branch, session)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                seating_id++,
                                exam_id,
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

                            await connection.query(
                                `INSERT INTO Seating_allocation
                                (seating_id, exam_id, room_no, block,
                                 column_no, bench_no, seat_position,
                                 username, batch, roll_no, branch, session)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                [
                                    seating_id++,
                                    exam_id,
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

        const hallWisePdfBuffer = await generateHallSeatingPdfByExamId(connection, exam_id, examDate);
        const totalSeatingPdfBuffer = await generateTotalSeatingPdfByExamId(connection, exam_id, examDate);

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
            [reportIdRow.nextReportId, "Hall-wise", examDate, hallWiseReportName, hallWiseFilePath]
        );

        await connection.query(
            `INSERT INTO Reports (report_id, report_type, exam_date, report_name, filepath)
             VALUES (?, ?, ?, ?, ?)`,
            [reportIdRow.nextReportId + 1, "Total Seating", examDate, totalSeatingReportName, totalSeatingFilePath]
        );

        await connection.commit();

        res.json({
            message: "Allocation generated successfully",
            reportName: hallWiseReportName,
            totalSeatingReportName
        });

    } catch (error) {
        await connection.rollback();
        console.error(error);
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

app.post('/api/allocation/save', (req, res) => {
    const { examDate, session, selectedYears, selectedRooms } = req.body;
    const yearsStr = JSON.stringify(selectedYears);
    const roomsStr = JSON.stringify(selectedRooms);

    const query = `
        INSERT INTO Allocation_History (id, exam_date, session, selected_years, selected_rooms)
        VALUES (1, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
            exam_date = VALUES(exam_date), 
            session = VALUES(session), 
            selected_years = VALUES(selected_years), 
            selected_rooms = VALUES(selected_rooms)
    `;

    db.query(query, [examDate, session, yearsStr, roomsStr], (err, result) => {
        if (err) return res.status(500).json({ error: "Failed to save selection" });
        res.json({ message: "Selection saved successfully" });
    });
});

app.get('/api/allocation/saved-state', (req, res) => {
    db.query('SELECT * FROM Allocation_History WHERE id = 1', (err, results) => {
        if (err) return res.status(500).json(err);
        if (results.length > 0) {
            const data = results[0];
            res.json({
                examDate: data.exam_date,
                session: data.session,
                selectedYears: JSON.parse(data.selected_years),
                selectedRooms: JSON.parse(data.selected_rooms)
            });
        } else {
            res.json(null);
        }
    });
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
FROM seating_allocation s
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
    const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    try {
        const page = await browser.newPage();
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

app.get("/api/reports", async (req, res) => {
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

app.get("/api/reports/:reportId/download", async (req, res) => {
    try {
        const [rows] = await db.promise().query(
            `SELECT report_name, filepath FROM Reports WHERE report_id = ?`,
            [req.params.reportId]
        );

        if (!rows.length) {
            return res.status(404).json({ message: "Report not found" });
        }

        const report = rows[0];
        if (!report.filepath || !fs.existsSync(report.filepath)) {
            return res.status(404).json({ message: "Report file not found" });
        }

        return res.download(report.filepath, `${report.report_name}.pdf`);
    } catch (error) {
        console.error("Download Report Error:", error);
        res.status(500).json({ message: "Failed to download report" });
    }
});

app.get("/api/reports/hall-seating/:date", async (req, res) => {
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


// --- JWT Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        console.log("No token provided");
        return res.sendStatus(401);
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            console.log("JWT Verification Error:", err.message);
            return res.sendStatus(403);
        }
        
        console.log("Logged in user data:", user); // Check if role exists here

        if (user.role !== 'student') {
            console.log(`Access denied for role: ${user.role}`);
            return res.status(403).json({ message: "Role must be 'student'" });
        }
        
        req.user = user;
        next();
    });
};

// --- API Routes ---

// 2. Get Profile
app.get('/api/student/profile', authenticateToken, (req, res) => {
    db.query('SELECT * FROM Student WHERE username = ?', [req.user.username], (err, results) => {
        if (err) {
            console.error("Database Error (Profile):", err); // <--- This logs it to your terminal
            return res.status(500).json({ error: err.message });
        }
        res.json(results[0]);
    });
});

// 3. Get Seating
app.get('/api/student/seating', authenticateToken, (req, res) => {
    const usernameFromToken = req.user.username;
    console.log("Fetching seating for username:", usernameFromToken);

    db.query('SELECT * FROM Seating_allocation WHERE username = ?', [usernameFromToken], (err, results) => {
        if (err) {
            console.error("Database Error:", err);
            return res.status(500).json(err);
        }
        console.log("Database Results Found:", results.length);
        console.log("Full Results:", results); // See what's actually inside
        res.json(results);
    });
});

// 4. Get Exam Timetable (Joining Seating and Exam Schedule)
app.get('/api/student/exams', authenticateToken, (req, res) => {
    const username = req.user.username;
    const query = `
        SELECT 
            es.exam_number,
            es.subject, 
            es.sub_code, 
            es.exam_date, 
            es.session
        FROM Seating_allocation sa
        JOIN Exam_schedule es ON sa.exam_id = es.exam_id
        WHERE sa.username = ?
        ORDER BY es.exam_date ASC
    `;
    db.query(query, [username], (err, results) => {
        if (err) return res.status(500).json({ error: "Failed to fetch timetable" });
        res.json(results);
    });
});

/* -------------------------------------------------------------------------- */
app.get('/api/teacher/dashboard', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token' });
        }

        if (String(user.role || '').toLowerCase() !== 'teacher') {
            return res.status(403).json({ message: "Role must be 'teacher'" });
        }

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
});

app.post('/api/teacher/unavailability', (req, res) => {
    const user = verifyRequestToken(req, res, 'teacher');

    if (!user) {
        return;
    }

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

app.get('/api/admin/requests/unread-count', async (req, res) => {
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

        res.json({ unreadCount: Number(countRow.unreadCount || 0) });
    } catch (error) {
        console.error('Failed to fetch unread request count:', error);
        res.status(500).json({ message: 'Failed to fetch unread request count.' });
    }
});

app.post('/api/admin/requests/mark-read', async (req, res) => {
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

app.get('/api/admin/requests', (req, res) => {
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

app.post('/api/admin/requests/:id/decision', async (req, res) => {
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
app.get('/api/duties/summary', (req, res) => {
    let { date, session } = req.query;
    if (!date || !session) return res.status(400).json({ error: "Missing date or session" });

    // FIX: This method extracts YYYY-MM-DD without shifting timezones
    const d = new Date(date);
    const formattedDate = d.getFullYear() + '-' + 
                          String(d.getMonth() + 1).padStart(2, '0') + '-' + 
                          String(d.getDate()).padStart(2, '0');

    console.log(`[Universal Summary Check] Fetching for: ${formattedDate} (${session})`);

    // Query 1: Get rooms from seating allocation
    const roomQuery = `SELECT selected_rooms FROM Allocation_History WHERE exam_date = ? AND session = ?`;

    db.query(roomQuery, [formattedDate, session], (err, roomResults) => {
        if (err) return res.status(500).json({ error: "Room Query Failed", details: err });

        let required = 0;
        let hasAllocation = false;

        if (roomResults.length > 0 && roomResults[0].selected_rooms) {
            try {
                const rooms = JSON.parse(roomResults[0].selected_rooms);
                required = rooms.length;
                hasAllocation = true;
            } catch (e) {
                console.error("Error parsing rooms:", e);
            }
        }

        // Query 2: Get available teachers (Must have duty_count > 0)
        const teacherQuery = `SELECT COUNT(*) as availableCount FROM Teacher WHERE UPPER(availability) = 'YES' AND duty_count > 0`;
        
        db.query(teacherQuery, (err, teacherResults) => {
            if (err) return res.status(500).json({ error: "Teacher Query Failed", details: err });

            // Query 3: Check if duties are already generated
            // We use a JOIN or a subquery to ensure the session matches the exam_id
            const checkGeneratedQuery = `
                SELECT COUNT(*) as dutyCount 
                FROM Duty_allocation d
                JOIN Exam_schedule e ON d.exam_id = e.exam_id
                WHERE d.exam_date = ? AND e.session = ?`;

            db.query(checkGeneratedQuery, [formattedDate, session], (err, checkResults) => {
                if (err) return res.status(500).json({ error: "Check Generated Failed", details: err });

                res.json({
                    required,
                    available: teacherResults[0].availableCount,
                    hasAllocation,
                    isGenerated: checkResults[0].dutyCount > 0
                });
            });
        });
    });
});

// 2. POST: Generate Duties with Fair Workload Balancing
app.post('/api/duties/generate', async (req, res) => {
    const { date, session } = req.body;
    const formattedDate = new Date(date).toISOString().split('T')[0];
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
        const [alloc] = await connection.query(
            `SELECT selected_rooms FROM Allocation_History WHERE exam_date = ? AND session = ?`, 
            [formattedDate, session]
        );
        if (!alloc.length) throw new Error("No Seating Allocation found. Please generate seating first.");
        const selectedRooms = JSON.parse(alloc[0].selected_rooms);

        // C. WORKLOAD RESTORE: If re-generating, give points back to previously assigned teachers
        const [prevDuties] = await connection.query(
            `SELECT Tusername FROM Duty_allocation WHERE exam_date = ? AND exam_id = ?`,
            [formattedDate, exam_id]
        );
        const previousUsernames = prevDuties.map(d => d.Tusername);
        if (prevDuties.length > 0) {
            await connection.query(
                `UPDATE Teacher SET duty_count = duty_count + 1 WHERE username IN (?)`,
                [previousUsernames]
            );
            await connection.query(
                `DELETE FROM Duty_allocation WHERE exam_date = ? AND exam_id = ?`,
                [formattedDate, exam_id]
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
            const block = roomFull.match(/[A-Za-z]+/)[0];
            const room_no = roomFull.match(/\d+/)[0];
            const tUser = teacherPool[index].username;
            assignedUsernames.push(tUser);
            return [exam_id, room_no, block, tUser, formattedDate];
        });

        // F. Finalize: Save assignments and decrement duty points
        await connection.query(
            `INSERT INTO Duty_allocation (exam_id, room_no, block, Tusername, exam_date) VALUES ?`,
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
                invigilationDutyFilePath
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
        res.status(500).json({ message: err.message });
    } finally {
        connection.release();
    }
});

// 3. GET: Fetch the assigned duty list for the table
app.get('/api/duties/list', (req, res) => {
    const { date, session } = req.query;
    if (!date) return res.status(400).json({ error: "Date is required" });
    const formattedDate = new Date(date).toISOString().split('T')[0];

    const query = `
        SELECT d.room_no, d.block, d.Tusername, t.name as teacher_name
        FROM Duty_allocation d
        JOIN Teacher t ON d.Tusername = t.username
        JOIN Exam_schedule e ON d.exam_id = e.exam_id
        WHERE d.exam_date = ? AND e.session = ?
        ORDER BY d.block ASC, d.room_no ASC
    `;
    db.query(query, [formattedDate, session], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// 4. GET: Helper for Calendar highlighting (Unique Exam Dates)
app.get('/api/exam-dates-only', (req, res) => {
    const query = 'SELECT DISTINCT exam_date FROM Exam_schedule ORDER BY exam_date ASC';
    db.query(query, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// 4b. GET: Exam Status Board data (slot-wise seating + duty status)
app.get('/api/exam-status-board', (req, res) => {
    const query = `
        SELECT
            slots.exam_date,
            slots.session,
            CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM Seating_allocation sa
                    JOIN Exam_schedule es2 ON es2.exam_id = sa.exam_id
                    WHERE es2.exam_date = slots.exam_date
                      AND es2.session = slots.session
                ) THEN 1
                ELSE 0
            END AS seating_done,
            CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM Duty_allocation da
                    JOIN Exam_schedule es3 ON es3.exam_id = da.exam_id
                    WHERE da.exam_date = slots.exam_date
                      AND es3.session = slots.session
                    WHERE da.exam_date = slots.exam_date
                      AND es3.session = slots.session
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
app.delete('/api/duties/delete', async (req, res) => {
    const { date, session } = req.body;
    const formattedDate = new Date(date).toISOString().split('T')[0];
    const slotKey = getDutySlotKey(formattedDate, session);

    const connection = await db.promise().getConnection();
    try {
        await connection.beginTransaction();

        // Find teachers assigned to this specific slot
        const [prevDuties] = await connection.query(
            `SELECT Tusername FROM Duty_allocation WHERE exam_date = ? AND EXISTS (SELECT 1 FROM Exam_schedule WHERE exam_id = Duty_allocation.exam_id AND session = ?)`,
            [formattedDate, session]
        );

        if (prevDuties.length > 0) {
            const usernames = prevDuties.map(d => d.Tusername);
            recentDutyAssignments.set(slotKey, usernames);
            
            // 1. Give points back
            await connection.query(
                `UPDATE Teacher SET duty_count = duty_count + 1 WHERE username IN (?)`,
                [usernames]
            );

            // 2. Delete the actual duties
            await connection.query(
                `DELETE FROM Duty_allocation WHERE exam_date = ? AND EXISTS (SELECT 1 FROM Exam_schedule WHERE exam_id = Duty_allocation.exam_id AND session = ?)`,
                [formattedDate, session]
            );
        }

        await connection.commit();
        res.json({ message: "Allocation deleted and faculty points restored." });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ message: err.message });
    } finally {
        connection.release();
    }
});
/* -------------------------------------------------------------------------- */
/* SERVER START                                */
/* -------------------------------------------------------------------------- */

const PORT = 5000;

app.listen(PORT, () => {
    console.log("-------------------------------------------");
    console.log(` Server running on http://localhost:${PORT} `);
    console.log("-------------------------------------------");
});