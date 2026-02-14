const express = require("express");
const mysql = require("mysql2");
const cors = require('cors');


const app = express();
app.use(cors());
app.use(express.json());

// -------------------- DATABASE CONNECTION --------------------
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "tree",
  database: "college"
});

// Test DB connection
db.connect((err) => {
  if (err) {
    console.log("Database connection failed:", err);
  } else {
    console.log("Connected to MariaDB!");
  }
});
//------------------------ManageRooms-------------------------
//get all rooms
app.get('/api/rooms', (req, res) => {
    db.query('SELECT * FROM Rooms', (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// POST a new room
app.post('/api/rooms', (req, res) => {
    const { room_no, block, capacity, cap_per_bench, col1, col2, col3, col4, col5 } = req.body;
    const query = `INSERT INTO Rooms (room_no, block, capacity, cap_per_bench, col1, col2, col3, col4, col5) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) 
                   ON DUPLICATE KEY UPDATE block=?, capacity=?, cap_per_bench=?, col1=?, col2=?, col3=?, col4=?, col5=?`;
    
    const values = [room_no, block, capacity, cap_per_bench, col1, col2, col3, col4, col5, 
                    block, capacity, cap_per_bench, col1, col2, col3, col4, col5];

    db.query(query, values, (err, result) => {
        if (err) return res.status(500).json(err);
        res.status(200).json({ message: 'Room saved successfully' });
    });
});


// -------------------- TEST ROUTE --------------------
app.get("/", (req, res) => {
  res.send("Backend running");
});

// -------------------- SERVER --------------------
app.listen(5000, () => {
  console.log("Server running on port 5000");
});
