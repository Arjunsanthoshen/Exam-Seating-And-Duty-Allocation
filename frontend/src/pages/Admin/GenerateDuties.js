import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import AdminSidebar from "./AdminSidebar";
import { FaChevronLeft, FaChevronRight, FaTrash } from "react-icons/fa"; // Removed unused icons
import "./GenerateDuties.css";

const GenerateDuties = () => {
  const [examDate, setExamDate] = useState(""); 
  const [session, setSession] = useState("FN");
  const [summary, setSummary] = useState({ required: 0, available: 0, hasAllocation: false, isGenerated: false });
  const [dutyList, setDutyList] = useState([]);
  const [allExamDates, setAllExamDates] = useState([]);
  const [viewDate, setViewDate] = useState(new Date());

  const getYYYYMMDD = (dateObj) => {
    return dateObj.toLocaleDateString('en-CA');
  };

  const fetchAllExamDates = useCallback(async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/exam-dates-only");
      const dates = res.data.map(d => getYYYYMMDD(new Date(d.exam_date)));
      setAllExamDates(dates);
      
      if (dates.length > 0 && !examDate) {
        setExamDate(dates[0]);
        setViewDate(new Date(dates[0]));
      }
    } catch (err) { console.error("Error fetching dates", err); }
  }, [examDate]);

  const fetchSummary = useCallback(async () => {
    if (!examDate) return;
    try {
      const res = await axios.get(`http://localhost:5000/api/duties/summary`, {
        params: { date: examDate, session: session }
      });
      setSummary(res.data);
      
      if (res.data.isGenerated) {
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

  const handleAction = async (type) => {
    if (type === 'delete' && !window.confirm("Delete this allocation? Faculty duty points will be restored.")) return;
    if (type === 'regen' && !window.confirm("Overwrite existing assignments with new teachers?")) return;

    try {
      if (type === 'delete') {
        await axios.delete("http://localhost:5000/api/duties/delete", { data: { date: examDate, session } });
      } else {
        await axios.post("http://localhost:5000/api/duties/generate", { date: examDate, session });
      }
      fetchSummary(); 
    } catch (err) { 
      alert(err.response?.data?.message || "Action failed"); 
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
      const dateStr = getYYYYMMDD(new Date(year, month, d));
      const isExam = allExamDates.includes(dateStr);
      const isSelected = examDate === dateStr;
      days.push(
        <div 
          key={d} 
          className={`cal-day ${isExam ? 'exam-day' : ''} ${isSelected ? 'active-day' : ''}`} 
          onClick={() => setExamDate(dateStr)}
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
            {/* Calendar Widget */}
            <div className="cal-widget">
              <div className="cal-nav">
                <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}><FaChevronLeft /></button>
                <span>{viewDate.toLocaleString('default', { month: 'short', year: 'numeric' })}</span>
                <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}><FaChevronRight /></button>
              </div>
              <div className="cal-week">
                {['S','M','T','W','T','F','S'].map(d => <div key={d}>{d}</div>)}
              </div>
              <div className="cal-grid">{renderCalendar()}</div>
            </div>

            {/* Controls */}
            <div className="duty-form">
              <div className="selection-status">
                <span className="date-display">Date: <strong>{examDate}</strong></span>
                <div className="session-toggle">
                  <button className={session === 'FN' ? 'active' : ''} onClick={() => setSession('FN')}>FN</button>
                  <button className={session === 'AN' ? 'active' : ''} onClick={() => setSession('AN')}>AN</button>
                </div>
              </div>

              <div className="summary-pills">
                <div className="pill">Req: <span>{summary.required}</span></div>
                <div className="pill">Avail: <span className={summary.available < summary.required ? 'danger' : 'success'}>{summary.available}</span></div>
              </div>

              <div className="action-btn-row">
                {!summary.isGenerated ? (
                  <button 
                    className="gen-btn-sm" 
                    onClick={() => handleAction('gen')} 
                    disabled={!summary.hasAllocation}
                  >
                    Generate
                  </button>
                ) : (
                  <>
                    <button className="regen-btn-sm" onClick={() => handleAction('regen')}>
                      Regenerate
                    </button>
                    <button className="delete-icon-btn" title="Delete Allocation" onClick={() => handleAction('delete')}>
                      <FaTrash />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="table-section">
            <table className="student-table">
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Block</th>
                  <th>Faculty Name</th>
                  <th>Username</th>
                </tr>
              </thead>
              <tbody>
                {dutyList.length > 0 ? dutyList.map((d, i) => (
                  <tr key={i}>
                    <td>{d.room_no}</td>
                    <td>{d.block}</td>
                    <td className="bold-faculty">{d.teacher_name}</td>
                    <td>{d.Tusername}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="4" className="empty-msg">No duties allocated for this slot.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default GenerateDuties;