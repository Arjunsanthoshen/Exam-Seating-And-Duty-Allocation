const express = require("express");
const mysql = require("mysql2");
const cors = require('cors');

const app = express();

// ----------------------------------------------------------------------------
//                              MIDDLEWARE
// ----------------------------------------------------------------------------
app.use(cors());
app.use(express.json());

// ----------------------------------------------------------------------------
//                          DATABASE CONNECTION
// ----------------------------------------------------------------------------
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "tree",
    database: "college"
});

db.connect((err) => {
    if (err) {
        console.error("Database connection failed:", err);
    } else {
        console.log("Connected to MariaDB successfully!");
    }
});

// ----------------------------------------------------------------------------
//                        STUDENT MANAGEMENT ROUTES
// ----------------------------------------------------------------------------

// GET: Fetch all student records
app.get('/api/students', (req, res) => {
    const query = 'SELECT year_of_join, branch, Branch_Strength FROM Student_manage ORDER BY year_of_join DESC, branch ASC';
    db.query(query, (err, results) => {
        if (err) {
            console.error("Fetch Error:", err);
            return res.status(500).json({ error: "Database fetch failed" });
        }
        res.json(results);
    });
});

// POST: Add new batch
app.post('/api/students/add', (req, res) => {
    const { year, branch, strength } = req.body;

    const checkQuery = 'SELECT * FROM Student_manage WHERE year_of_join = ? AND branch = ?';
    db.query(checkQuery, [year, branch], (err, results) => {
        if (err) return res.status(500).json(err);
        
        if (results.length > 0) {
            return res.status(409).json({ message: `Record for ${branch} ${year} already exists!` });
        }

        const insertQuery = `INSERT INTO Student_manage (year_of_join, branch, Branch_Strength, stid) VALUES (?, ?, ?, 1)`;
        db.query(insertQuery, [year, branch, strength], (err, result) => {
            if (err) {
                console.error("Insert Error:", err);
                return res.status(500).json(err);
            }
            res.status(200).json({ message: 'Record saved successfully' });
        });
    });
});

// PUT: Update an existing record
app.put('/api/students/update', (req, res) => {
    const { year, branch, strength } = req.body;
    const query = `UPDATE Student_manage SET Branch_Strength = ? WHERE year_of_join = ? AND branch = ?`;
    
    db.query(query, [strength, year, branch], (err, result) => {
        if (err) {
            console.error("Update Error:", err);
            return res.status(500).json(err);
        }
        res.json({ message: "Record updated successfully" });
    });
});

// DELETE: Remove a student record
app.delete('/api/students/:year/:branch', (req, res) => {
    const { year, branch } = req.params;
    const query = `DELETE FROM Student_manage WHERE year_of_join = ? AND branch = ?`;
    db.query(query, [year, branch], (err, result) => {
        if (err) {
            console.error("Delete Error:", err);
            return res.status(500).json(err);
        }
        res.json({ message: "Record deleted successfully" });
    });
});

// ----------------------------------------------------------------------------
//                            MANAGE ROOMS ROUTES
// ----------------------------------------------------------------------------

app.get('/api/rooms', (req, res) => {
    db.query('SELECT * FROM Rooms ORDER BY block ASC, room_no ASC', (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

app.post('/api/rooms', (req, res) => {
    const { room_no, block, capacity, cap_per_bench, col1, col2, col3, col4, col5 } = req.body;
    const query = `INSERT INTO Rooms (room_no, block, capacity, cap_per_bench, col1, col2, col3, col4, col5) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) 
                   ON DUPLICATE KEY UPDATE capacity=?, cap_per_bench=?, col1=?, col2=?, col3=?, col4=?, col5=?`;
    const values = [
        room_no, block, capacity, cap_per_bench, col1, col2, col3, col4, col5, 
        capacity, cap_per_bench, col1, col2, col3, col4, col5
    ];
    db.query(query, values, (err, result) => {
        if (err) {
            console.error("Room Save Error:", err);
            return res.status(500).json(err);
        }
        res.status(200).json({ message: 'Room saved successfully' });
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

// ----------------------------------------------------------------------------
//                        MANAGE TEACHERS ROUTES
// ----------------------------------------------------------------------------

// GET: View all teachers
app.get('/api/teachers', (req, res) => {
    const query = `
        SELECT username, name, availability, department, phone
        FROM Teacher
        ORDER BY name ASC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error("Fetch Teachers Error:", err);
            return res.status(500).json({ error: "Database fetch failed" });
        }
        res.json(results);
    });
});


// POST: Add a new teacher
app.post('/api/teachers', (req, res) => {
    const { username, password, name, availability, department, phone } = req.body;

    db.beginTransaction(err => {
        if (err) return res.status(500).json(err);

        // Insert into Users table
        const userQuery = `
            INSERT INTO Users (username, role, password)
            VALUES (?, 'Teacher', ?)
        `;

        db.query(userQuery, [username, password], (err) => {
            if (err) {
                return db.rollback(() =>
                    res.status(500).json({ message: "Username already exists" })
                );
            }

            // Insert into Teacher table
            const teacherQuery = `
                INSERT INTO Teacher (username, name, availability, department, phone)
                VALUES (?, ?, ?, ?, ?)
            `;

            db.query(
                teacherQuery,
                [username, name, availability, department, phone],
                (err) => {
                    if (err) {
                        return db.rollback(() => res.status(500).json(err));
                    }

                    db.commit(err => {
                        if (err) {
                            return db.rollback(() => res.status(500).json(err));
                        }
                        res.json({ message: "Teacher added successfully" });
                    });
                }
            );
        });
    });
});


// DELETE: Remove teacher
// (Delete from Users → Teacher auto deletes due to CASCADE)
app.delete('/api/teachers/:username', (req, res) => {
    const { username } = req.params;

    const query = "DELETE FROM Users WHERE username = ?";

    db.query(query, [username], (err) => {
        if (err) {
            console.error("Delete Teacher Error:", err);
            return res.status(500).json(err);
        }
        res.json({ message: "Teacher deleted successfully" });
    });
});


// PUT: Update availability only
app.put('/api/teachers/availability', (req, res) => {
    const { username, availability } = req.body;

    const query = `
        UPDATE Teacher
        SET availability = ?
        WHERE username = ?
    `;

    db.query(query, [availability, username], (err, result) => {
        if (err) {
            console.error("Update Availability Error:", err);
            return res.status(500).json(err);
        }
        res.json({ message: "Availability updated successfully" });
    });
});


// ----------------------------------------------------------------------------
//                              LOGIN ROUTES
// ----------------------------------------------------------------------------

app.post("/api/login", (req, res) => {
    const { username, password, role } = req.body;
    const query = `SELECT * FROM Users WHERE username = ? AND password = ? AND role = ?`;
    db.query(query, [username, password, role], (err, results) => {
        if (err) {
            console.error("Login Error:", err);
            return res.status(500).json({ message: "Server error" });
        }
        if (results.length > 0) res.json({ success: true, role: role });
        else res.status(401).json({ success: false, message: "Invalid credentials" });
    });
});

// ----------------------------------------------------------------------------
//                              SERVER START
// ----------------------------------------------------------------------------
const PORT = 5000;
app.listen(PORT, () => {
    console.log("-------------------------------------------");
    console.log(` Server running on http://localhost:${PORT} `);
    console.log("-------------------------------------------");
});