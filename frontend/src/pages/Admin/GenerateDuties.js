import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import AdminSidebar from "./AdminSidebar";
import { FaChevronLeft, FaChevronRight, FaChevronUp, FaChevronDown } from "react-icons/fa";
import "./GenerateDuties.css";

const GenerateDuties = () => {
  const [examDate, setExamDate] = useState(""); 
  const [session, setSession] = useState("FN");
  const [summary, setSummary] = useState({ required: 0, available: 0, hasAllocation: false });
  const [dutyList, setDutyList] = useState([]);
  const [allExamDates, setAllExamDates] = useState([]);
  const [viewDate, setViewDate] = useState(new Date());

  // Helper to get strict YYYY-MM-DD string
  const getYYYYMMDD = (dateObj) => {
    return dateObj.toLocaleDateString('en-CA'); // Reliable YYYY-MM-DD format
  };

  const fetchAllExamDates = useCallback(async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/exam-dates-only");
      // Standardize all dates from DB to YYYY-MM-DD strings
      const dates = res.data.map(d => getYYYYMMDD(new Date(d.exam_date)));
      setAllExamDates(dates);
      
      if (dates.length > 0 && !examDate) {
        setExamDate(dates[0]);
        setViewDate(new Date(dates[0]));
      }
    } catch (err) { console.error("Error fetching exam dates", err); }
  }, [examDate]);

  const fetchSummary = useCallback(async () => {
    if (!examDate) return;
    try {
      const res = await axios.get(`http://localhost:5000/api/duties/summary`, {
        params: { date: examDate, session: session }
      });
      setSummary(res.data);
      
      if (res.data.hasAllocation) {
        const dRes = await axios.get(`http://localhost:5000/api/duties/list`, {
          params: { date: examDate, session: session }
        });
        setDutyList(dRes.data);
      } else {
        setDutyList([]);
      }
    } catch (err) { console.error(err); }
  }, [examDate, session]);

  useEffect(() => { fetchAllExamDates(); }, [fetchAllExamDates]);
  useEffect(() => { if (examDate) fetchSummary(); }, [examDate, session, fetchSummary]);

  const handleGenerate = async () => {
    try {
      const res = await axios.post("http://localhost:5000/api/duties/generate", { date: examDate, session });
      alert(res.data.message);
      fetchSummary();
    } catch (err) { alert(err.response?.data?.message || "Generation failed"); }
  };

  const changeMonth = (offset) => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
  };

  const stepExam = (dir) => {
    const idx = allExamDates.indexOf(examDate);
    const nextIdx = idx + dir;
    if (nextIdx >= 0 && nextIdx < allExamDates.length) {
      setExamDate(allExamDates[nextIdx]);
      setViewDate(new Date(allExamDates[nextIdx]));
    }
  };

  const renderCalendar = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="cal-day empty"></div>);
    
    for (let d = 1; d <= daysInMonth; d++) {
      // Create current day string in YYYY-MM-DD
      const dateStr = getYYYYMMDD(new Date(year, month, d));
      const isExam = allExamDates.includes(dateStr);
      const isSelected = examDate === dateStr;
      
      days.push(
        <div 
          key={d} 
          className={`cal-day ${isExam ? 'exam-day' : ''} ${isSelected ? 'active-day' : ''}`}
          onClick={() => setExamDate(dateStr)} // Removed 'isExam' restriction so selection is free
        >
          {d}
        </div>
      );
    }
    return days;
  };

  return (
    <div className="dashboard-container">
      <AdminSidebar />
      <main className="main-content">
        <div className="manage-card">
          <h2 className="card-title">Faculty Duty Allocation</h2>
          
          <div className="duty-header-grid">
            <div className="cal-widget">
              <div className="cal-nav">
                <button onClick={() => changeMonth(-1)}><FaChevronLeft /></button>
                <span>{viewDate.toLocaleString('default', { month: 'short', year: 'numeric' })}</span>
                <button onClick={() => changeMonth(1)}><FaChevronRight /></button>
                <div className="v-divider"></div>
                <div className="step-group">
                  <button onClick={() => stepExam(-1)} disabled={allExamDates.indexOf(examDate) <= 0}><FaChevronUp /></button>
                  <button onClick={() => stepExam(1)} disabled={allExamDates.indexOf(examDate) >= allExamDates.length - 1 || allExamDates.indexOf(examDate) === -1}><FaChevronDown /></button>
                </div>
              </div>
              <div className="cal-week">
                {['S','M','T','W','T','F','S'].map(d => <div key={d}>{d}</div>)}
              </div>
              <div className="cal-grid">{renderCalendar()}</div>
            </div>

            <div className="duty-form">
              <div className="selection-status">
                <span className="date-display">Date: <strong>{examDate || "Select from Calendar"}</strong></span>
                <div className="session-toggle">
                  <button className={session === 'FN' ? 'active' : ''} onClick={() => setSession('FN')}>FN</button>
                  <button className={session === 'AN' ? 'active' : ''} onClick={() => setSession('AN')}>AN</button>
                </div>
              </div>

              <div className="summary-pills">
                <div className="pill">Req: <span>{summary.required}</span></div>
                <div className="pill">Avail: <span className={summary.available < summary.required ? 'danger' : 'success'}>{summary.available}</span></div>
              </div>

              <button className="gen-btn" onClick={handleGenerate} disabled={!summary.hasAllocation}>
                {summary.hasAllocation ? "Generate Duties" : "Seating Not Generated"}
              </button>
            </div>
          </div>

          <div className="table-section">
            <table className="student-table">
              <thead>
                <tr><th>Room</th><th>Block</th><th>Faculty Name</th><th>Username</th></tr>
              </thead>
              <tbody>
                {dutyList.length > 0 ? dutyList.map((d, i) => (
                  <tr key={i}>
                    <td>{d.room_no}</td><td>{d.block}</td>
                    <td className="bold-faculty">{d.teacher_name}</td><td>{d.Tusername}</td>
                  </tr>
                )) : <tr><td colSpan="4" className="empty-msg">No duties allocated for this slot.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default GenerateDuties;