const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const jwt = require('jsonwebtoken');

const app = express();

/* -------------------------------------------------------------------------- */
/*                                 MIDDLEWARE                                 */
/* -------------------------------------------------------------------------- */

app.use(cors());
app.use(express.json());

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

const getDutySlotKey = (date, session) => `${date}__${session}`;
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

app.post('/api/teachers', (req, res) => {
    const { username, password, name, availability, department, phone } = req.body;

    db.beginTransaction(err => {
        if (err) return res.status(500).json(err);

        db.query(
            `INSERT INTO Users (username, role, password) VALUES (?, 'Teacher', ?)`,
            [username, password],
            (err) => {
                if (err) return db.rollback(() =>
                    res.status(500).json({ message: "Username already exists" })
                );

                db.query(
                    `INSERT INTO Teacher (username, name, availability, department, phone)
                     VALUES (?, ?, ?, ?, ?)`,
                    [username, name, availability, department, phone],
                    (err) => {
                        if (err) return db.rollback(() => res.status(500).json(err));

                        db.commit(err => {
                            if (err) return db.rollback(() => res.status(500).json(err));
                            res.json({ message: "Teacher added successfully" });
                        });
                    }
                );
            }
        );
    });
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
/*                          EXAM SCHEDULE ROUTES                              */
/* -------------------------------------------------------------------------- */

// GET ALL
app.get('/api/exam-schedule', (req, res) => {
    const query = `
        SELECT * FROM Exam_schedule
        ORDER BY exam_date DESC, year ASC
    `;

    db.query(query, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// ADD
app.post('/api/exam-schedule/add', (req, res) => {
    const { year, date, session, subjects, examNumber } = req.body;

    const values = Object.entries(subjects)
        .filter(([_, name]) => name && name.trim() !== "")
        .map(([branch, name]) =>
            [year, examNumber, date, session, branch, name]
        );

    if (values.length === 0)
        return res.status(400).json({ error: "No subjects to save" });

    const query = `
        INSERT INTO Exam_schedule
        (year, exam_number, exam_date, session, branch, subject)
        VALUES ?
    `;

    db.query(query, [values], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Schedule saved successfully" });
    });
});

// UPDATE
app.post('/api/exam-schedule/update/:id', (req, res) => {
    const { year, date, session, subjects, examNumber } = req.body;

    const branch = Object.keys(subjects).find(b => subjects[b] !== "");
    const subjectName = subjects[branch];

    const query = `
        UPDATE Exam_schedule
        SET year=?, exam_number=?, exam_date=?, session=?, branch=?, subject=?
        WHERE exam_id=?
    `;

    db.query(query,
        [year, examNumber, date, session, branch, subjectName, req.params.id],
        (err) => {
            if (err) return res.status(500).json(err);
            res.json({ message: "Updated successfully" });
        }
    );
});

// DELETE
app.delete('/api/exam-schedule/:id', (req, res) => {
    db.query(
        'DELETE FROM Exam_schedule WHERE exam_id = ?',
        [req.params.id],
        (err) => {
            if (err) return res.status(500).json(err);
            res.json({ message: "Deleted successfully" });
        }
    );
});

/* -------------------------------------------------------------------------- */
/*                                LOGIN ROUTES                                */
/* -------------------------------------------------------------------------- */

// app.post("/api/login", (req, res) => {
//     const { username, password, role } = req.body;

//     const query = `
//         SELECT * FROM Users
//         WHERE username = ? AND password = ? AND role = ?
//     `;

//     db.query(query, [username, password, role], (err, results) => {
//         if (err) return res.status(500).json({ message: "Server error" });

//         if (results.length > 0)
//             res.json({ success: true, role });
//         else
//             res.status(401).json({ success: false, message: "Invalid credentials" });
//     });
// });
app.post("/api/login", (req, res) => {
    const { username, password, role } = req.body;

    const query = `
        SELECT * FROM Users 
        WHERE username = ? AND password = ? AND role = ?
    `;

    db.query(query, [username, password, role], (err, results) => {
        if (err) return res.status(500).json({ message: "Server error" });

        if (results.length > 0) {
            // 1. Create the payload (data to store inside the token)
            const userPayload = { 
                username: results[0].username, 
                role: results[0].role 
            };

            // 2. Generate the JWT Token
            const accessToken = jwt.sign(userPayload, SECRET_KEY, { expiresIn: '1h' });

            // 3. Send the token back to the frontend
            res.json({ 
                success: true, 
                accessToken: accessToken, // Frontend needs this!
                role: results[0].role 
            });
        } else {
            res.status(401).json({ success: false, message: "Invalid credentials" });
        }
    });
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

        await connection.commit();

        res.json({
            message: "Allocation generated successfully"
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
//                        Student Portal
// ----------------------------------------------------------------------------


const SECRET_KEY = "your_jwt_secret_key";

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

// 1. Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.query('SELECT * FROM Users WHERE username = ? AND password = ?', [username, password], (err, results) => {
        if (results.length > 0) {
            const user = { username: results[0].username, role: results[0].role };
            const accessToken = jwt.sign(user, SECRET_KEY);
            res.json({ accessToken });
        } else {
            res.status(401).send('Username or password incorrect');
        }
    });
});

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

/* -------------------------------------------------------------------------- */
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

    // Query 1: Get required invigilator count from actual seating allocation for this slot
    const roomQuery = `
        SELECT COUNT(DISTINCT CONCAT(sa.block, '-', sa.room_no)) AS required
        FROM Seating_allocation sa
        JOIN Exam_schedule es ON es.exam_id = sa.exam_id
        WHERE es.exam_date = ? AND es.session = ? AND sa.session = ?
    `;

    db.query(roomQuery, [formattedDate, session, session], (err, roomResults) => {
        if (err) return res.status(500).json({ error: "Room Query Failed", details: err });

        const required = Number(roomResults?.[0]?.required || 0);
        const hasAllocation = required > 0;

        // Query 2: Get available teachers (Must have duty_count > 0)
        const teacherQuery = `SELECT COUNT(*) as availableCount FROM Teacher WHERE UPPER(availability) = 'YES' AND duty_count > 0`;
        
        db.query(teacherQuery, (err, teacherResults) => {
            if (err) return res.status(500).json({ error: "Teacher Query Failed", details: err });

            // Query 3: Check if duties are already generated for this exact slot
            const checkGeneratedQuery = `
                SELECT COUNT(*) as dutyCount 
                FROM Duty_allocation d
                WHERE d.exam_date = ? AND d.session = ?`;

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
    if (!date || !session) return res.status(400).json({ message: "Date and session are required." });
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

        // B. Get the list of rooms from actual seating allocation for this exam/session
        const [alloc] = await connection.query(
            `SELECT DISTINCT room_no, block
             FROM Seating_allocation
             WHERE exam_id = ? AND session = ?
             ORDER BY block ASC, room_no ASC`,
            [exam_id, session]
        );
        if (!alloc.length) throw new Error("No Seating Allocation found for this session. Please generate seating first.");
        const selectedRooms = alloc;

        // C. WORKLOAD RESTORE: If re-generating, give points back to previously assigned teachers
        const [prevDuties] = await connection.query(
            `SELECT Tusername FROM Duty_allocation WHERE exam_date = ? AND exam_id = ? AND session = ?`,
            [formattedDate, exam_id, session]
        );
        const previousUsernames = prevDuties.map(d => d.Tusername);
        if (prevDuties.length > 0) {
            await connection.query(
                `UPDATE Teacher SET duty_count = duty_count + 1 WHERE username IN (?)`,
                [previousUsernames]
            );
            await connection.query(
                `DELETE FROM Duty_allocation WHERE exam_date = ? AND exam_id = ? AND session = ?`,
                [formattedDate, exam_id, session]
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
        const dutyValues = selectedRooms.map((room, index) => {
            const block = room.block;
            const room_no = room.room_no;
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

        await connection.commit();
        recentDutyAssignments.set(slotKey, assignedUsernames);
        res.json({ message: "Duties generated successfully with workload balancing." });

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
    if (!date || !session) return res.status(400).json({ error: "Date and session are required" });
    const formattedDate = new Date(date).toISOString().split('T')[0];

    const query = `
        SELECT d.room_no, d.block, d.Tusername, t.name as teacher_name
        FROM Duty_allocation d
        JOIN Teacher t ON d.Tusername = t.username
        WHERE d.exam_date = ? AND d.session = ?
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
app.delete('/api/duties/delete', async (req, res) => {
    const { date, session } = req.body;
    if (!date || !session) return res.status(400).json({ message: "Date and session are required." });
    const formattedDate = new Date(date).toISOString().split('T')[0];
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
            const usernames = prevDuties.map(d => d.Tusername);
            recentDutyAssignments.set(slotKey, usernames);
            
            // 1. Give points back
            await connection.query(
                `UPDATE Teacher SET duty_count = duty_count + 1 WHERE username IN (?)`,
                [usernames]
            );

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
        res.status(500).json({ message: err.message });
    } finally {
        connection.release();
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
