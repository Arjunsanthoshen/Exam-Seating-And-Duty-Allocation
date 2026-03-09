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


const app = express();

/* -------------------------------------------------------------------------- */
/*                                 MIDDLEWARE                                 */
/* -------------------------------------------------------------------------- */

app.use(cors());
app.use(express.json());
app.use(express.json());

/* -------------------------------------------------------------------------- */
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
/* -------------------------------------------------------------------------- */
/*                        STUDENT MANAGEMENT ROUTES                           */
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
/*                             MANAGE ROOMS ROUTES                            */
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
/*                           MANAGE TEACHERS ROUTES                           */
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
/*                         TEACHER EXCEL UPLOAD ROUTE                         */
/* -------------------------------------------------------------------------- */

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
        const hashedDefaultPassword = await bcrypt.hash("sjcet", 10);

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



// ADD EXAM
app.post('/api/exam-schedule/add', (req, res) => {

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

        });

});



// DELETE EXAM
app.delete('/api/exam-schedule/:id', (req, res) => {

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
/*                                LOGIN ROUTES                                */
/* -------------------------------------------------------------------------- */

app.post("/api/login", (req, res) => {

    const { username, password, role } = req.body;

    const query = `
        SELECT * FROM Users
        WHERE username = ? AND role = ?
    `;

    db.query(query, [username, role], async (err, results) => {

        if (err)
            return res.status(500).json({ message: "Server error" });

        if (results.length === 0)
            return res.status(401).json({ message: "User not found" });

        const user = results[0];

        const match = await bcrypt.compare(password, user.password);

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
//                        SEATING ALLOCATION ROUTES
// ----------------------------------------------------------------------------

// GET: Fetch required data for the Allocation page
app.get('/api/allocation/init', async (req, res) => {
    try {
        // Fetch rooms for the toggle list
        const [rooms] = await db.promise().query('SELECT block, room_no, capacity FROM Rooms ORDER BY block, room_no');
        
        // Fetch student counts grouped by join year
        // We calculate academic year based on current year
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

            const benchesPerColumn =
                Math.floor(room.capacity / (columns.length * room.cap_per_bench));

            for (let colIndex = 0; colIndex < columns.length; colIndex++) {

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

                for (let bench = 1; bench <= benchesPerColumn; bench++) {

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

        const pdfBuffer = await generateHallSeatingPdfByExamId(connection, exam_id, examDate);
        const nextReportNumber = await getNextHallWiseReportNumber(connection);
        const reportName = `hall-wise-report${nextReportNumber}`;
        const fileName = `${reportName}.pdf`;
        const filePath = path.join(generatedReportsDir, fileName);

        fs.writeFileSync(filePath, pdfBuffer);

        const [[reportIdRow]] = await connection.query(
            `SELECT COALESCE(MAX(report_id), 0) + 1 AS nextReportId FROM Reports`
        );

        await connection.query(
            `INSERT INTO Reports (report_id, report_type, exam_date, report_name, filepath)
             VALUES (?, ?, ?, ?, ?)`,
            [reportIdRow.nextReportId, "Hall-wise", examDate, reportName, filePath]
        );

        await connection.commit();

        res.json({
            message: "Allocation generated successfully",
            reportName
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
//                        SAVE & FETCH SELECTION ROUTES
// ----------------------------------------------------------------------------

// POST: Save current selection
app.post('/api/allocation/save', (req, res) => {
    const { examDate, session, selectedYears, selectedRooms } = req.body;

    // Convert arrays to strings for MySQL storage
    const yearsStr = JSON.stringify(selectedYears);
    const roomsStr = JSON.stringify(selectedRooms);

    // We use ID 1 to maintain a single 'Last Saved' state
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
        if (err) {
            console.error("Save Selection Error:", err);
            return res.status(500).json({ error: "Failed to save selection" });
        }
        res.json({ message: "Selection saved successfully" });
    });
});

// GET: Fetch saved selection (Update your existing init route or add this)
app.get('/api/allocation/saved-state', (req, res) => {
    db.query('SELECT * FROM Allocation_History WHERE id = 1', (err, results) => {
        if (err) return res.status(500).json(err);
        if (results.length > 0) {
            const data = results[0];
            // Convert strings back to arrays/objects
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
    s.branch,
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

function buildHallSeatingHtml(rows, examDate) {
    const rooms = {};

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
                cap: r.cap_per_bench
            };
        }

        rooms[key].seats.push(r);
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

        .page{
            page-break-after:always;
        }

        </style>

        </head>

        <body>

        <div class="college">
        ST. JOSEPH'S COLLEGE OF ENGINEERING & TECHNOLOGY, PALAI
        </div>

        <div>
        Seating Arrangement - ${examDate}
        </div>
        `;

    Object.keys(rooms).forEach(room => {

        html += `<div class="page">`;

        html += `<div class="room">Room: ${room}</div>`;

        html += `<table>`;

        /* MAIN COLUMN HEADER */

        html += `<tr>`;

        rooms[room].columns.forEach((_, index) => {

            const letter = String.fromCharCode(65 + index);

            if (rooms[room].cap === 2)
                html += `<th colspan="2">${letter}</th>`;
            else
                html += `<th>${letter}</th>`;

        });

        html += `</tr>`;


        /* SUB HEADER ONLY IF 2 PER BENCH */

        if (rooms[room].cap === 2) {

            html += `<tr>`;

            rooms[room].columns.forEach(() => {

                html += `<th>L</th>`;
                html += `<th>R</th>`;

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

            rooms[room].columns.forEach((benchCount, cIndex) => {

                const col = cIndex + 1;

                /* BENCH DOES NOT EXIST */

                if (r > benchCount) {

                    if (rooms[room].cap === 2)
                        html += `<td style="background:black"></td><td style="background:black"></td>`;
                    else
                        html += `<td style="background:black"></td>`;

                    return;
                }

                const seat = (grid[r] && grid[r][col]) ? grid[r][col] : {};

                if (rooms[room].cap === 2) {

                    html += `<td>${seat.left || ""}</td>`;
                    html += `<td>${seat.right || ""}</td>`;

                } else {

                    html += `<td>${seat.left || ""}</td>`;

                }

            });

            html += `</tr>`;
        }

        html += `</table>`;

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

    const html = buildHallSeatingHtml(rows, examDate);
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


/* -------------------------------------------------------------------------- */
/*                                SERVER START                                */
/* -------------------------------------------------------------------------- */

const PORT = 5000;

app.listen(PORT, () => {
    console.log("-------------------------------------------");
    console.log(` Server running on http://localhost:${PORT} `);
    console.log("-------------------------------------------");
});
