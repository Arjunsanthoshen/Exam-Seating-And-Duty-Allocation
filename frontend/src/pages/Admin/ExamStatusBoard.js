import React, { useState, useEffect } from "react";
import axios from "axios";
import AdminSidebar from "./AdminSidebar";
import { FaRegClock, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import "./ExamStatusBoard.css";

function ExamStatusBoard() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [statusRows, setStatusRows] = useState([]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchStatusBoard = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/exam-status-board");
        setStatusRows(res.data || []);
      } catch (error) {
        console.error("Failed to load exam status board", error);
      }
    };

    fetchStatusBoard();
  }, []);

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true 
    }) + " IST";
  };

  const formatExamDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  const renderStatus = (done) => (
    <span
      className={`status-badge ${done ? "done" : "not-done"}`}
      title={done ? "Allocation completed" : "Allocation pending"}
    >
      {done ? <FaCheckCircle className="status-icon" /> : <FaTimesCircle className="status-icon" />}
    </span>
  );

  return (
    <div className="dashboard-container">
      <AdminSidebar />

      <main className="main-content">
        <header className="top-bar">
          <div className="welcome-section">
            <h1 className="welcome-text">Welcome, Admin</h1>
          </div>
          
          <div className="date-time-box">
            <div className="current-date">{formatDate(currentTime)}</div>
            <div className="current-time">
              {formatTime(currentTime)} <FaRegClock className="clock-icon" />
            </div>
          </div>
        </header>

        <section className="glass-card full-width-card">
           <div className="card-header">
              <div className="card-title-wrap">
                <h2>Exam Status Board</h2>
                <p className="card-subtitle">Slot-wise seating and duty completion</p>
              </div>
           </div>
           <hr className="divider" />

           <div className="status-table-wrap">
              <table className="status-table">
                <thead>
                  <tr>
                    <th>Exam Date</th>
                    <th>Session</th>
                    <th>Seating Status</th>
                    <th>Duty Status</th>
                  </tr>
                </thead>
                <tbody>
                  {statusRows.length > 0 ? (
                    statusRows.map((row, index) => (
                      <tr key={`${row.exam_date}-${row.session}-${index}`}>
                        <td>{formatExamDate(row.exam_date)}</td>
                        <td>{row.session}</td>
                        <td>{renderStatus(Boolean(row.seating_done))}</td>
                        <td>{renderStatus(Boolean(row.duty_done))}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="empty-row">
                        No exams scheduled yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
           </div>
        </section>
      </main>
    </div>
  );
}

export default ExamStatusBoard;
