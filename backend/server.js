const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const jwt = require('jsonwebtoken');

const app = express();

/* -------------------------------------------------------------------------- */
/* MIDDLEWARE                                 */
/* -------------------------------------------------------------------------- */

app.use(cors());
app.use(express.json());

/* -------------------------------------------------------------------------- */
/* DATABASE CONNECTION                             */
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
/* EXAM SCHEDULE ROUTES                             */
/* -------------------------------------------------------------------------- */

// GET ALL: Updated to select all columns including sub_code
app.get('/api/exam-schedule', (req, res) => {
    const query = `
        SELECT * FROM exam_schedule
        ORDER BY exam_date DESC, year ASC
    `;

    db.query(query, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// ADD: Updated to handle nested object structure {name, code} and batch insert
app.post('/api/exam-schedule/add', (req, res) => {
    const { year, date, session, subjects, examNumber } = req.body;

    // Filter branches where at least a name is entered, then map to SQL array
    const values = Object.entries(subjects)
        .filter(([_, sub]) => sub.name && sub.name.trim() !== "")
        .map(([branch, sub]) =>
            [year, examNumber, date, session, branch, sub.name, sub.code]
        );

    if (values.length === 0)
        return res.status(400).json({ error: "No subjects to save" });

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
});

// DELETE
app.delete('/api/exam-schedule/:id', (req, res) => {
    db.query(
        'DELETE FROM exam_schedule WHERE exam_id = ?',
        [req.params.id],
        (err) => {
            if (err) return res.status(500).json(err);
            res.json({ message: "Deleted successfully" });
        }
    );
});

/* -------------------------------------------------------------------------- */
/* LOGIN ROUTES                                */
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
/* FACULTY DUTY ALLOCATION ROUTES                      */
/* -------------------------------------------------------------------------- */

// 1. GET: Fetch duty summary
app.get('/api/duties/summary', (req, res) => {
    let { date, session } = req.query;
    if (!date || !session) return res.status(400).json({ error: "Missing date" });

    const formattedDate = new Date(date).toISOString().split('T')[0];
    
    // Query 1: Get the rooms from seating allocation
    const roomQuery = `SELECT selected_rooms FROM Allocation_History WHERE exam_date = ? AND session = ?`;
    
    db.query(roomQuery, [formattedDate, session], (err, roomResults) => {
        if (err) return res.status(500).json(err);
        
        // UPDATE THESE VARIABLES BASED ON DATABASE RESULTS
        let required = 0;
        let hasAllocation = false;

        if (roomResults.length > 0) {
            const rooms = JSON.parse(roomResults[0].selected_rooms);
            required = rooms.length; // Count of rooms = required teachers
            hasAllocation = true;    // Seating exists, so we can generate duties
        }

        // Query 2: Get available teachers
        const teacherQuery = `SELECT COUNT(*) as availableCount FROM Teacher WHERE UPPER(availability) = 'YES' AND duty_count > 0`;
        db.query(teacherQuery, (err, teacherResults) => {
            if (err) return res.status(500).json(err);

            // Query 3: Check if already generated
            const checkGeneratedQuery = `SELECT COUNT(*) as dutyCount FROM Duty_allocation WHERE exam_date = ? AND EXISTS (SELECT 1 FROM Exam_schedule WHERE exam_id = Duty_allocation.exam_id AND session = ?)`;
            db.query(checkGeneratedQuery, [formattedDate, session], (err, checkResults) => {
                if (err) return res.status(500).json(err);

                // Now sending the ACTUAL calculated values
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