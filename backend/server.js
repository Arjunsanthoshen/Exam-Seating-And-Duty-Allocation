const express = require("express");
const mysql = require("mysql2");
const app = express();

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

// -------------------- TEST ROUTE --------------------
app.get("/", (req, res) => {
  res.send("Backend running");
});

// -------------------- SERVER --------------------
app.listen(5000, () => {
  console.log("Server running on port 5000");
});
