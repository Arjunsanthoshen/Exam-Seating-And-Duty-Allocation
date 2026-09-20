import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import AdminSidebar from "./AdminSidebar";
import { API_BASE_URL } from "../../api/config";
import { FaChevronLeft, FaChevronRight, FaTrash, FaSpinner, FaCheckCircle, FaRegClock } from "react-icons/fa";
import "./GenerateDuties.css";

const GenerateDuties = () => {
  const [examDate, setExamDate] = useState(""); 
  const [session, setSession] = useState("FN");
  const [summary, setSummary] = useState({ required: 0, available: 0, hasAllocation: false, isGenerated: false });
  const [dutyList, setDutyList] = useState([]);
  const [allExamDates, setAllExamDates] = useState([]);
  const [viewDate, setViewDate] = useState(new Date());

  // Modern Loading Modal States
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionType, setActionType] = useState("gen"); // "gen" | "regen" | "delete"
  const [processTitle, setProcessTitle] = useState("");
  const [processPhase, setProcessPhase] = useState("");
  const [processProgress, setProcessProgress] = useState(0);
  const [processSuccess, setProcessSuccess] = useState(false);

  // Demo Cooldown State
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const isDemoUser = localStorage.getItem("isDemo") === "true" || (localStorage.getItem("username") || "").toLowerCase() === "demo";

  const getYYYYMMDD = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const fetchAllExamDates = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/exam-dates-only`);
      const dates = res.data.map(d => getYYYYMMDD(new Date(d.exam_date)));
      setAllExamDates(dates);
      
      if (dates.length > 0 && !examDate) {
        setExamDate(dates[0]);
        setViewDate(new Date(dates[0]));
      }
    } catch (err) { 
      console.error("Error fetching dates", err); 
    }
  }, [examDate]);

  const fetchSummary = useCallback(async () => {
    if (!examDate) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/duties/summary`, {
        params: { date: examDate, session: session }
      });
      setSummary(res.data);
      
      if (res.data.isGenerated) {
        const dRes = await axios.get(`${API_BASE_URL}/api/duties/list`, {
          params: { date: examDate, session: session }
        });
        setDutyList(dRes.data);
      } else {
        setDutyList([]);
      }
    } catch (err) { 
      console.error(err); 
    }
  }, [examDate, session]);

  useEffect(() => { fetchAllExamDates(); }, [fetchAllExamDates]);
  useEffect(() => { if (examDate) fetchSummary(); }, [examDate, session, fetchSummary]);

  // Demo Cooldown Sync
  useEffect(() => {
    if (!isDemoUser) return;
    let isMounted = true;
    const fetchCooldown = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API_BASE_URL}/api/admin/demo-cooldowns`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (isMounted && res.data && res.data.dutyRemaining > 0) {
          setCooldownRemaining(res.data.dutyRemaining);
        }
      } catch (e) {}
    };
    fetchCooldown();
    return () => { isMounted = false; };
  }, [isDemoUser, examDate, session]);

  // Demo Cooldown Ticker
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const interval = setInterval(() => {
      setCooldownRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownRemaining]);

  const handleAction = async (type) => {
    if (type === 'delete') {
      if (!window.confirm("Delete this allocation? Faculty duty points will be restored.")) return;
      try {
        setActionType('delete');
        await axios.delete(`${API_BASE_URL}/api/duties/delete`, { data: { date: examDate, session } });
        setIsProcessing(true);
        setProcessProgress(100);
        setProcessSuccess(true);
        setProcessTitle("Deleted");
        setProcessPhase(`Duty allocation removed for ${examDate} (${session}). Faculty points restored.`);
        setTimeout(() => {
          setIsProcessing(false);
          setProcessSuccess(false);
          fetchSummary();
        }, 1800);
      } catch (err) {
        alert(err.response?.data?.message || "Action failed");
      }
      return;
    }

    if (type === 'gen' && !summary.hasAllocation) {
      alert(`Seat not allocated for ${examDate} (${session}). Please generate seating allocation first before allocating duties.`);
      return;
    }

    if (isDemoUser && cooldownRemaining > 0) {
      alert(`Demo cooldown active. Please wait ${cooldownRemaining}s before generating duties again.`);
      return;
    }

    if (type === 'regen' && !window.confirm("Overwrite existing assignments with new teachers?")) return;

    setActionType(type);
    setIsProcessing(true);
    setProcessSuccess(false);
    setProcessProgress(20);
    if (type === 'regen') {
      setProcessTitle("Regenerating Faculty Duties");
      setProcessPhase("Restoring previous faculty points & clearing slot...");
    } else {
      setProcessTitle("Generating Faculty Duty Allocation");
      setProcessPhase("Checking faculty availability & eligibility quotas...");
    }

    const t1 = setTimeout(() => {
      setProcessProgress(55);
      setProcessPhase("Balancing workload points and fairness metrics...");
    }, 400);

    const t2 = setTimeout(() => {
      setProcessProgress(85);
      setProcessPhase("Assigning faculty invigilators to exam halls...");
    }, 800);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/duties/generate`, { date: examDate, session });
      clearTimeout(t1);
      clearTimeout(t2);
      setProcessProgress(100);
      setProcessSuccess(true);
      setProcessTitle("Done! Duties Allocated");
      if (isDemoUser) {
        setCooldownRemaining(300);
      }
      const reportMessage = response.data?.reportName
        ? ` Report saved as ${response.data.reportName}.`
        : "";
      setProcessPhase((response.data?.message || "Faculty duties allocated successfully!") + reportMessage);

      // Auto-close after 2.5 seconds without separate alert popup
      setTimeout(() => {
        setIsProcessing(false);
        setProcessSuccess(false);
        fetchSummary();
      }, 2500);
    } catch (err) { 
      clearTimeout(t1);
      clearTimeout(t2);
      setIsProcessing(false);
      setProcessSuccess(false);
      if (err.response?.status === 429 && err.response.data?.remainingSeconds) {
        setCooldownRemaining(err.response.data.remainingSeconds);
      }
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
          className={`cal-day ${isExam ? 'exam-day' : 'disabled-day'} ${isSelected ? 'active-day' : ''}`} 
          onClick={() => {
            if (isExam) {
              setExamDate(dateStr);
            }
          }}
          title={isExam ? `Scheduled Exam: ${dateStr}` : "No exams scheduled on this date"}
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
                <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}><FaChevronLeft /></button>
                <span>{viewDate.toLocaleString('default', { month: 'short', year: 'numeric' })}</span>
                <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}><FaChevronRight /></button>
              </div>
              <div className="cal-week">
                {['S','M','T','W','T','F','S'].map((d, i) => <div key={i}>{d}</div>)}
              </div>
              <div className="cal-grid">{renderCalendar()}</div>
            </div>

            {/* Controls */}
            <div className="duty-form">
              <div className="selection-status">
                <span className="date-display">Date: <strong>{examDate || "Select exam date"}</strong></span>
                <div className="session-toggle">
                  <button type="button" className={session === 'FN' ? 'active' : ''} onClick={() => setSession('FN')}>FN</button>
                  <button type="button" className={session === 'AN' ? 'active' : ''} onClick={() => setSession('AN')}>AN</button>
                </div>
              </div>

              <div className="summary-pills">
                <div className="pill">Req: <span>{summary.required}</span></div>
                <div className="pill">Avail: <span className={summary.available < summary.required ? 'danger' : 'success'}>{summary.available}</span></div>
              </div>

              {/* Seat Not Allocated Warning */}
              {!summary.hasAllocation && (
                <div className="duty-unallocated-alert">
                  <span>⚠️ Seat not allocated for this date & session</span>
                </div>
              )}

              <div className="action-btn-row">
                {isDemoUser && cooldownRemaining > 0 && (
                  <div className="demo-cooldown-badge">
                    <FaRegClock className="cooldown-icon" /> Demo Cooldown: {Math.floor(cooldownRemaining / 60)}:{String(cooldownRemaining % 60).padStart(2, '0')}
                  </div>
                )}
                {!summary.isGenerated ? (
                  <button 
                    type="button"
                    className={`gen-btn-sm ${!summary.hasAllocation ? 'btn-unallocated' : ''}`} 
                    onClick={() => handleAction('gen')} 
                    disabled={isDemoUser && cooldownRemaining > 0}
                    title={!summary.hasAllocation ? "Seat not allocated for this date/session" : (isDemoUser && cooldownRemaining > 0 ? `Demo cooldown active (${cooldownRemaining}s)` : "Allocate faculty duties")}
                  >
                    {!summary.hasAllocation ? "Seat Not Allocated" : (isDemoUser && cooldownRemaining > 0 ? `Cooldown (${cooldownRemaining}s)` : "Allocate Duties")}
                  </button>
                ) : (
                  <>
                    <button 
                      type="button" 
                      className="regen-btn-sm" 
                      onClick={() => handleAction('regen')}
                      disabled={isDemoUser && cooldownRemaining > 0}
                      title={isDemoUser && cooldownRemaining > 0 ? `Demo cooldown active (${cooldownRemaining}s)` : "Regenerate Duties"}
                    >
                      {isDemoUser && cooldownRemaining > 0 ? `Cooldown (${cooldownRemaining}s)` : "Regenerate Duties"}
                    </button>
                    <button type="button" className="delete-icon-btn action-delete-duty" title="Delete Allocation" onClick={() => handleAction('delete')}>
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
                  <th className="th-center">Room</th>
                  <th className="th-center">Block</th>
                  <th className="th-center">Faculty Name</th>
                  <th className="th-center">Username</th>
                </tr>
              </thead>
              <tbody>
                {dutyList.length > 0 ? dutyList.map((d, i) => (
                  <tr key={i}>
                    <td className="td-center"><span className="room-num-badge">Room {d.room_no}</span></td>
                    <td className="td-center"><strong className="branch-tag">{d.block}</strong></td>
                    <td className="td-center bold-faculty">{d.teacher_name}</td>
                    <td className="td-center"><span className="code-pill-tag">{d.Tusername}</span></td>
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

      {/* Modern Glassmorphic Loading Modal */}
      {isProcessing && (
        <div className="modern-loading-overlay">
          <div className={`modern-loading-card ${processSuccess ? (actionType === 'delete' ? 'deleted-state' : 'success-state') : ''}`}>
            <div className={`loader-glow-ring ${processSuccess ? (actionType === 'delete' ? 'deleted-ring' : 'success-ring') : ''}`}>
              {processSuccess ? (
                actionType === 'delete' ? (
                  <FaTrash className="deleted-icon" />
                ) : (
                  <FaCheckCircle className="done-icon" />
                )
              ) : (
                <FaSpinner className="spinning-icon" />
              )}
            </div>
            <h3 className={`loading-card-title ${processSuccess && actionType === 'delete' ? 'deleted-title' : ''}`}>
              {processSuccess && actionType === 'delete' ? 'Deleted' : processTitle}
            </h3>
            <p className="loading-card-phase">{processPhase}</p>
            
            <div className="modern-progress-track">
              <div 
                className={`modern-progress-fill ${processSuccess ? (actionType === 'delete' ? 'deleted-fill' : 'success-fill') : ''}`} 
                style={{ width: `${processProgress}%` }}
              >
                <div className="shimmer-effect"></div>
              </div>
            </div>
            
            <div className="loading-card-footer">
              <span>{processSuccess ? (actionType === 'delete' ? 'Deleted ✓' : 'Complete ✓') : `${processProgress}% Complete`}</span>
              <span>Slot: {examDate} ({session})</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerateDuties;
