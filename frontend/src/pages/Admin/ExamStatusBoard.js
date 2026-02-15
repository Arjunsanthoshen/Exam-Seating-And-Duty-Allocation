import React, { useState, useEffect } from "react";
import AdminSidebar from "./AdminSidebar";
import { FaRegClock } from "react-icons/fa";
import "./ExamStatusBoard.css";

function ExamStatusBoard() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
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
              <h2>Exam Status Board</h2>
              <button className="create-exam-btn">+ Create Exam</button>
           </div>
           <hr className="divider" />
           
           <div className="placeholder-content">
              <p>The dashboard is ready for your exam data integration.</p>
           </div>
        </section>
      </main>
    </div>
  );
}

export default ExamStatusBoard;