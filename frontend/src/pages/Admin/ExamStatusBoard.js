import React, { useState, useEffect } from "react";
import axios from "axios";
import AdminSidebar from "./AdminSidebar";
import { 
  FaCheckCircle, FaExclamationTriangle,
  FaClock, FaShieldAlt, FaCalendarAlt
} from "react-icons/fa";
import "./ExamStatusBoard.css";

const LiveClock = React.memo(() => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
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
    <div className="admin-clock-box">
      <FaClock className="admin-clock-icon" />
      <div className="admin-clock-data">
        <span className="admin-time-val">{formatTime(time)}</span>
        <span className="admin-date-val">{formatDate(time)}</span>
      </div>
    </div>
  );
});

function ExamStatusBoard() {
  const [statusRows, setStatusRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatusBoard = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/exam-status-board");
        setStatusRows(res.data || []);
      } catch (error) {
        console.error("Failed to load exam status board", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatusBoard();
  }, []);

  const formatExamDate = (dateStr) => {
    if (!dateStr) return "";
    const cleanStr = String(dateStr).split('T')[0];
    const parts = cleanStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  const totalSlots = statusRows.length;
  const seatingDoneCount = statusRows.filter(r => Boolean(r.seating_done)).length;
  const dutyDoneCount = statusRows.filter(r => Boolean(r.duty_done)).length;
  const seatingPercent = totalSlots > 0 ? Math.round((seatingDoneCount / totalSlots) * 100) : 0;
  const dutyPercent = totalSlots > 0 ? Math.round((dutyDoneCount / totalSlots) * 100) : 0;

  return (
    <div className="admin-page-container">
      <AdminSidebar />

      <main className="admin-main-viewport">
        {/* Modern Top Header */}
        <header className="admin-header-glass">
          <div className="admin-header-left">
            <div className="admin-context-pill">
              <FaShieldAlt /> EXAM CELL CONTROL TOWER
            </div>
            <h1>Examination Status Board</h1>
            <p className="admin-header-sub">
              Live automated tracking of exam schedules, hall seating generation, and invigilation duties.
            </p>
          </div>

          <LiveClock />
        </header>

        {/* Smart Metric Summary Cards */}
        <div className="admin-metrics-grid">
          <div className="admin-metric-card">
            <div className="admin-metric-top">
              <span className="metric-title">TOTAL EXAM SLOTS</span>
              <span className="metric-badge blue">Scheduled</span>
            </div>
            <div className="metric-value-row">
              <span className="metric-number">{totalSlots}</span>
              <span className="metric-context">Exam Sessions</span>
            </div>
            <div className="metric-progress-track">
              <div className="metric-progress-fill blue" style={{ width: '100%' }}></div>
            </div>
            <span className="metric-subtext">Active academic cycle</span>
          </div>

          <div className="admin-metric-card">
            <div className="admin-metric-top">
              <span className="metric-title">SEATING ARRANGEMENT</span>
              <span className={`metric-badge ${seatingPercent === 100 ? 'green' : 'amber'}`}>
                {seatingPercent}% Ready
              </span>
            </div>
            <div className="metric-value-row">
              <span className="metric-number">{seatingDoneCount} <small>/ {totalSlots}</small></span>
              <span className="metric-context">Slots Completed</span>
            </div>
            <div className="metric-progress-track">
              <div className="metric-progress-fill green" style={{ width: `${seatingPercent}%` }}></div>
            </div>
            <span className="metric-subtext">{totalSlots - seatingDoneCount} slots pending seating</span>
          </div>

          <div className="admin-metric-card">
            <div className="admin-metric-top">
              <span className="metric-title">FACULTY DUTIES</span>
              <span className={`metric-badge ${dutyPercent === 100 ? 'green' : 'amber'}`}>
                {dutyPercent}% Assigned
              </span>
            </div>
            <div className="metric-value-row">
              <span className="metric-number">{dutyDoneCount} <small>/ {totalSlots}</small></span>
              <span className="metric-context">Slots Completed</span>
            </div>
            <div className="metric-progress-track">
              <div className="metric-progress-fill violet" style={{ width: `${dutyPercent}%` }}></div>
            </div>
            <span className="metric-subtext">{totalSlots - dutyDoneCount} slots pending duty roster</span>
          </div>
        </div>

        {/* Status Table Glass Card */}
        <section className="admin-glass-panel">
          <div className="admin-panel-head">
            <div className="panel-title-group">
              <h2>Slot-wise Completion Matrix</h2>
              <p>Real-time completion state for examination seating and invigilator assignment</p>
            </div>
            <button 
              type="button" 
              className="admin-refresh-btn"
              onClick={() => window.location.reload()}
            >
              Sync Status
            </button>
          </div>

          <div className="admin-table-scroll">
            <table className="admin-modern-table">
              <thead>
                <tr>
                  <th className="th-center">Exam Date</th>
                  <th className="th-center">Session</th>
                  <th className="th-center">Seating Status</th>
                  <th className="th-center">Duty Status</th>
                  <th className="th-center">Overall Readiness</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="admin-loading-cell">
                      <div className="admin-table-spinner"></div>
                      <span>Loading status matrix...</span>
                    </td>
                  </tr>
                ) : statusRows.length > 0 ? (
                  statusRows.map((row, index) => {
                    const isSeatingDone = Boolean(row.seating_done);
                    const isDutyDone = Boolean(row.duty_done);
                    return (
                      <tr key={`${row.exam_date}-${row.session}-${index}`}>
                        <td className="td-center">
                          <div className="admin-date-col">
                            <FaCalendarAlt className="col-icon blue" />
                            <strong>{formatExamDate(row.exam_date)}</strong>
                          </div>
                        </td>

                        <td className="td-center">
                          <span className={`admin-session-chip ${row.session}`}>
                            {row.session === 'FN' ? 'FN • Forenoon' : 'AN • Afternoon'}
                          </span>
                        </td>

                        <td className="td-center">
                          <div className="admin-status-flex">
                            {isSeatingDone ? (
                              <span className="admin-pill-status done">
                                <FaCheckCircle /> Allocated
                              </span>
                            ) : (
                              <span className="admin-pill-status pending">
                                <FaExclamationTriangle /> Pending
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="td-center">
                          <div className="admin-status-flex">
                            {isDutyDone ? (
                              <span className="admin-pill-status done">
                                <FaCheckCircle /> Assigned
                              </span>
                            ) : (
                              <span className="admin-pill-status pending">
                                <FaExclamationTriangle /> Pending
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="td-center">
                          {isSeatingDone && isDutyDone ? (
                            <span className="admin-ready-tag">
                              <FaCheckCircle /> Fully Ready
                            </span>
                          ) : isSeatingDone ? (
                            <span className="admin-pill-status partial">
                              <FaCheckCircle /> Seating Ready
                            </span>
                          ) : (
                            <span className="admin-pill-status pending">
                              <FaExclamationTriangle /> Setup Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="5" className="admin-empty-cell">
                      <div className="admin-empty-content">
                        <FaCalendarAlt className="empty-icon" />
                        <h3>No Scheduled Exams</h3>
                        <p>No exams have been scheduled yet. Go to Exam Schedule to add new exam dates.</p>
                      </div>
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
