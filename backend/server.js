const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

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
})

/* -------------------------------------------------------------------------- */
/* STUDENT MANAGEMENT ROUTES                           */
/* -------------------------------------------------------------------------- */

app.get('/api/students', (req, res) => {
    const query = `
        SELECT year_of_join, branch, Branch_Strength 
        FROM Student_manage 
        ORDER BY year_of_join DESC, branch ASC
    `;

    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: "Database fetch failed" });
        res.json(results);
    });
});

app.post('/api/students/add', (req, res) => {
    const { year, branch, strength } = req.body;

    const checkQuery = `
        SELECT * FROM Student_manage 
        WHERE year_of_join = ? AND branch = ?
    `;

    db.query(checkQuery, [year, branch], (err, results) => {
        if (err) return res.status(500).json(err);

        if (results.length > 0) {
            return res.status(409).json({ message: `Record for ${branch} ${year} already exists!` });
        }

        const insertQuery = `
            INSERT INTO Student_manage 
            (year_of_join, branch, Branch_Strength, stid)
            VALUES (?, ?, ?, 1)
        `;

        db.query(insertQuery, [year, branch, strength], (err) => {
            if (err) return res.status(500).json(err);
            res.status(200).json({ message: "Record saved successfully" });
        });
    });
});

app.put('/api/students/update', (req, res) => {
    const { year, branch, strength } = req.body;

    const query = `
        UPDATE Student_manage 
        SET Branch_Strength = ? 
        WHERE year_of_join = ? AND branch = ?
    `;

    db.query(query, [strength, year, branch], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Record updated successfully" });
    });
});

app.delete('/api/students/:year/:branch', (req, res) => {
    const { year, branch } = req.params;

    const query = `
        DELETE FROM Student_manage 
        WHERE year_of_join = ? AND branch = ?
    `;

    db.query(query, [year, branch], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Record deleted successfully" });
    });
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

app.post("/api/login", (req, res) => {
    const { username, password, role } = req.body;

    const query = `
        SELECT * FROM Users
        WHERE username = ? AND password = ? AND role = ?
    `;

    db.query(query, [username, password, role], (err, results) => {
        if (err) return res.status(500).json({ message: "Server error" });

        if (results.length > 0)
            res.json({ success: true, role });
        else
            res.status(401).json({ success: false, message: "Invalid credentials" });
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
            `SELECT exam_id FROM exam_schedule
             WHERE exam_date = ? AND session = ?`,
            [examDate, session]
        );

        if (!examRows.length) {
            await connection.rollback();
            return res.status(400).json({ message: "No exam found." });
        }

        const exam_id = examRows[0].exam_id;

        // 2️⃣ Fetch Selected Rooms
        const [rooms] = await connection.query(
            `SELECT * FROM Rooms
             WHERE CONCAT(block, room_no) IN (?)
             ORDER BY block ASC, room_no ASC`,
            [selectedRooms]
        );

        // ... [Allocation Logic remains the same] ...

        await connection.commit();
        res.json({ message: "Allocation generated successfully" });

    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ message: "Allocation failed: " + error.message });
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

/* -------------------------------------------------------------------------- */
/* SERVER START                                */
/* -------------------------------------------------------------------------- */

const PORT = 5000;

app.listen(PORT, () => {
    console.log("-------------------------------------------");
    console.log(` Server running on http://localhost:${PORT} `);
    console.log("-------------------------------------------");
});