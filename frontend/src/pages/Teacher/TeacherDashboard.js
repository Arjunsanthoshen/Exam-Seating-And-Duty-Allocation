import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FaCalendarAlt,
  FaClipboardList,
  FaKey,
  FaPowerOff,
  FaTimes,
  FaChalkboardTeacher,
  FaCheckCircle,
  FaClock,
  FaBuilding,
  FaExclamationCircle,
  FaUserShield
} from "react-icons/fa";
import { API_BASE_URL } from "../../api/config";
import "./TeacherDashboard.css";

const LiveClock = React.memo(() => {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="teacher-clock-pill">
      <FaClock className="teacher-clock-icon" />
      <div className="teacher-clock-content">
        <span className="teacher-time-text">
          {time.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
        </span>
        <span className="teacher-date-text">
          {time.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
        </span>
      </div>
    </div>
  );
});

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getLocalDateValue = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split("T")[0];
  };

  const [teacherName, setTeacherName] = useState("Faculty Member");
  const [duties, setDuties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState({ type: "", text: "" });

  const [formData, setFormData] = useState(() => ({
    examDate: getLocalDateValue(),
    session: "FN",
    reason: ""
  }));

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const reasonWordCount = formData.reason.trim()
    ? formData.reason.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const isReasonTooLong = reasonWordCount > 40;

  const activeSection = useMemo(
    () => (location.pathname === "/MarkUnavailability" ? "unavailability" : "schedule"),
    [location.pathname]
  );

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    axios
      .get(`${API_BASE_URL}/api/teacher/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((response) => {
        setTeacherName(response.data.teacher?.name || "Faculty Member");
        setDuties(response.data.duties || []);
        setLoading(false);
      })
      .catch((error) => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          localStorage.removeItem("token");
          localStorage.removeItem("role");
          localStorage.removeItem("username");
          navigate("/login");
          return;
        }
        console.error("Failed to load teacher dashboard", error);
        setLoading(false);
      });
  }, [navigate]);

  const formatDisplayDate = (dateValue) => {
    if (!dateValue) return "-";
    return new Date(dateValue).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    navigate("/login");
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value
    }));
  };

  const handlePasswordInputChange = (event) => {
    const { name, value } = event.target;
    setPasswordForm((current) => ({
      ...current,
      [name]: value
    }));
    setPasswordMsg({ type: "", text: "" });
  };

  const resetPasswordForm = () => {
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    });
    setPasswordMsg({ type: "", text: "" });
  };

  const handlePasswordSubmit = (event) => {
    event.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMsg({ type: "error", text: "New password and retyped password must match." });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordMsg({ type: "error", text: "Password must be at least 6 characters long." });
      return;
    }

    setChangingPassword(true);

    axios.post(
      `${API_BASE_URL}/api/teacher/change-password`,
      passwordForm,
      { headers: { Authorization: `Bearer ${token}` } }
    ).then((response) => {
      setPasswordMsg({ type: "success", text: response.data?.message || "Password changed successfully!" });
      setTimeout(() => {
        resetPasswordForm();
        setShowPasswordModal(false);
      }, 1500);
    }).catch((error) => {
      const message = error.response?.data?.message || "Failed to change password.";
      setPasswordMsg({ type: "error", text: message });
    }).finally(() => {
      setChangingPassword(false);
    });
  };

  const handleUnavailabilitySubmit = (event) => {
    event.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    if (isReasonTooLong) {
      window.alert("Reason exceeds the 40-word limit. Please shorten your explanation.");
      return;
    }

    setSubmittingRequest(true);

    axios.post(
      `${API_BASE_URL}/api/teacher/unavailability`,
      formData,
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(() => {
      window.alert("Unavailability request submitted successfully! Administrator has been notified.");
      setFormData({
        examDate: getLocalDateValue(),
        session: "FN",
        reason: ""
      });
    }).catch((error) => {
      const message = error.response?.data?.message || "Failed to submit unavailability request.";
      window.alert(message);
    }).finally(() => {
      setSubmittingRequest(false);
    });
  };

  if (loading) {
    return (
      <div className="teacher-loading-screen">
        <div className="teacher-loading-spinner"></div>
        <p>Loading Faculty Portal...</p>
      </div>
    );
  }

  const upcomingDuty = duties[0];

  return (
    <div className="teacher-dashboard">
      {/* Sleek Glassmorphic Sidebar */}
      <aside className="teacher-sidebar">
        <div className="teacher-sidebar-brand">
          <div className="teacher-brand-icon-box">
            <FaChalkboardTeacher className="teacher-brand-icon" />
          </div>
          <div className="teacher-brand-info">
            <span className="teacher-portal-tag">FACULTY PORTAL</span>
            <h3>Exam Allocation</h3>
          </div>
        </div>

        <nav className="teacher-nav-group">
          <button
            type="button"
            className={`teacher-nav-item ${activeSection === "schedule" ? "active" : ""}`}
            onClick={() => navigate("/MyDutySchedule")}
          >
            <FaClipboardList className="teacher-nav-icon" />
            <span>My Duty Schedule</span>
            {duties.length > 0 && <span className="teacher-nav-badge">{duties.length}</span>}
          </button>

          <button
            type="button"
            className={`teacher-nav-item ${activeSection === "unavailability" ? "active" : ""}`}
            onClick={() => navigate("/MarkUnavailability")}
          >
            <FaTimes className="teacher-nav-icon" />
            <span>Mark Unavailability</span>
          </button>
        </nav>

        {/* User Card & Logout */}
        <div className="teacher-sidebar-footer">
          <div className="teacher-user-chip">
            <div className="teacher-avatar">
              {teacherName.charAt(0).toUpperCase()}
            </div>
            <div className="teacher-user-details">
              <span className="teacher-user-name" title={teacherName}>{teacherName}</span>
              <span className="teacher-user-role">Invigilator</span>
            </div>
          </div>
          <button type="button" className="teacher-logout-btn" onClick={handleLogout}>
            <FaPowerOff className="teacher-nav-icon" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="teacher-main">
        {activeSection === "schedule" ? (
          <>
            {/* Top Glassmorphic Header */}
            <header className="teacher-glass-header">
              <div className="teacher-header-left">
                <div className="teacher-welcome-badge">
                  <FaUserShield /> OFFICIAL FACULTY DASHBOARD
                </div>
                <h1>Welcome back, {teacherName}</h1>
                <p className="teacher-subtitle">
                  Here is your invigilation duty assignment and examination schedule.
                </p>
              </div>

              <div className="teacher-header-right">
                <LiveClock />

                <button
                  type="button"
                  className="teacher-action-btn secondary"
                  onClick={() => setShowPasswordModal(true)}
                >
                  <FaKey />
                  <span>Security</span>
                </button>
              </div>
            </header>

            {/* Overview Quick Stats */}
            <div className="teacher-stats-grid">
              <div className="teacher-stat-card">
                <div className="teacher-stat-icon-wrapper blue">
                  <FaClipboardList />
                </div>
                <div className="teacher-stat-data">
                  <span className="teacher-stat-label">Assigned Duties</span>
                  <span className="teacher-stat-value">{duties.length}</span>
                  <span className="teacher-stat-hint">Scheduled exam slots</span>
                </div>
              </div>

              <div className="teacher-stat-card">
                <div className="teacher-stat-icon-wrapper emerald">
                  <FaCalendarAlt />
                </div>
                <div className="teacher-stat-data">
                  <span className="teacher-stat-label">Next Invigilation</span>
                  <span className="teacher-stat-value date-val">
                    {upcomingDuty ? formatDisplayDate(upcomingDuty.exam_date) : "None"}
                  </span>
                  <span className="teacher-stat-hint">
                    {upcomingDuty ? `Session: ${upcomingDuty.session} • Room: ${upcomingDuty.exam_hall}` : "All duties completed"}
                  </span>
                </div>
              </div>

              <div className="teacher-stat-card">
                <div className="teacher-stat-icon-wrapper violet">
                  <FaCheckCircle />
                </div>
                <div className="teacher-stat-data">
                  <span className="teacher-stat-label">Invigilator Status</span>
                  <span className="teacher-stat-value status-active">Active</span>
                  <span className="teacher-stat-hint">Duty roster confirmed</span>
                </div>
              </div>
            </div>

            {/* Duty Schedule Table Card */}
            <section className="teacher-glass-card">
              <div className="teacher-card-head">
                <div>
                  <h2>My Duty Schedule</h2>
                  <p>Detailed invigilation assignments generated by the examination cell</p>
                </div>
                {duties.length > 0 && (
                  <span className="teacher-count-badge">
                    {duties.length} {duties.length === 1 ? "Session" : "Sessions"} Allocated
                  </span>
                )}
              </div>

              <div className="teacher-table-responsive">
                <table className="teacher-modern-table">
                  <thead>
                    <tr>
                      <th className="th-center" style={{ width: "27%" }}>Exam Date</th>
                      <th className="th-center" style={{ width: "29%" }}>Session</th>
                      <th className="th-center" style={{ width: "22%" }}>Exam Hall</th>
                      <th className="th-center" style={{ width: "22%" }}>Duty Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duties.length > 0 ? (
                      duties.map((duty, index) => (
                        <tr key={`${duty.exam_date}-${duty.session}-${duty.exam_hall}-${index}`}>
                          <td className="td-center">
                            <div className="teacher-date-cell">
                              <FaCalendarAlt className="teacher-cell-icon" />
                              <strong>{formatDisplayDate(duty.exam_date)}</strong>
                            </div>
                          </td>
                          <td className="td-center">
                            <span className={`teacher-session-pill ${duty.session}`}>
                              {duty.session === "FN" ? "FN • Forenoon (09:30 AM)" : "AN • Afternoon (01:30 PM)"}
                            </span>
                          </td>
                          <td className="td-center">
                            <div className="teacher-hall-pill">
                              <FaBuilding className="teacher-cell-icon" />
                              <span>{duty.exam_hall || "To be allocated"}</span>
                            </div>
                          </td>
                          <td className="td-center">
                            <span className="teacher-status-pill confirmed">
                              <FaCheckCircle /> Confirmed
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4">
                          <div className="teacher-empty-state">
                            <div className="teacher-empty-icon">
                              <FaClipboardList />
                            </div>
                            <h3>No Duty Allocations Found</h3>
                            <p>
                              You currently have no exam invigilation duties scheduled.
                              Assignments will appear here automatically once generated.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <>
            {/* Mark Unavailability Header */}
            <header className="teacher-glass-header">
              <div className="teacher-header-left">
                <div className="teacher-welcome-badge">
                  <FaTimes /> LEAVE & UNAVAILABILITY REQUEST
                </div>
                <h1>Request Duty Exemption</h1>
                <p className="teacher-subtitle">
                  Notify administration in advance if you are unavailable for examination duties on specific dates.
                </p>
              </div>
            </header>

            {/* Modern Form Glass Card */}
            <section className="teacher-glass-card teacher-form-card-wrap">
              <form className="teacher-unavailability-form" onSubmit={handleUnavailabilitySubmit}>
                <div className="teacher-form-row">
                  <div className="teacher-form-group">
                    <label>
                      <FaCalendarAlt className="teacher-form-icon" />
                      <span>Exam Date</span>
                    </label>
                    <input
                      type="date"
                      name="examDate"
                      className="teacher-modern-input"
                      value={formData.examDate}
                      onChange={handleFormChange}
                      required
                    />
                  </div>

                  <div className="teacher-form-group">
                    <label>
                      <FaClock className="teacher-form-icon" />
                      <span>Target Session</span>
                    </label>
                    <div className="teacher-session-selector">
                      {["FN", "AN", "Both"].map((sess) => (
                        <button
                          key={sess}
                          type="button"
                          className={`teacher-session-btn ${formData.session === sess ? "selected" : ""}`}
                          onClick={() => setFormData((curr) => ({ ...curr, session: sess }))}
                        >
                          {sess === "Both" ? "Both (Full Day)" : sess}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="teacher-form-group full-width">
                  <div className="teacher-label-row">
                    <label>
                      <FaClipboardList className="teacher-form-icon" />
                      <span>Reason for Unavailability</span>
                    </label>
                    <span className={`teacher-word-indicator ${isReasonTooLong ? "limit-reached" : ""}`}>
                      {reasonWordCount} / 40 words
                    </span>
                  </div>

                  <textarea
                    name="reason"
                    className={`teacher-modern-textarea ${isReasonTooLong ? "input-error" : ""}`}
                    value={formData.reason}
                    onChange={handleFormChange}
                    rows="4"
                    placeholder="Provide a brief explanation for your unavailability (e.g. Medical emergency, official training, pre-approved leave)..."
                    required
                  />

                  {isReasonTooLong && (
                    <div className="teacher-validation-msg">
                      <FaExclamationCircle /> Please shorten your explanation to 40 words or fewer.
                    </div>
                  )}
                </div>

                <div className="teacher-form-actions">
                  <button
                    type="submit"
                    className="teacher-action-btn primary large"
                    disabled={submittingRequest || isReasonTooLong || !formData.reason.trim()}
                  >
                    {submittingRequest ? "Submitting Request..." : "Submit Unavailability Request"}
                  </button>
                </div>
              </form>
            </section>
          </>
        )}
      </main>

      {/* Security / Password Modal */}
      {showPasswordModal && (
        <div className="teacher-modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="teacher-modal-glass" onClick={(e) => e.stopPropagation()}>
            <div className="teacher-modal-head">
              <div className="teacher-modal-title">
                <FaKey className="teacher-modal-icon" />
                <h3>Change Account Password</h3>
              </div>
              <button
                type="button"
                className="teacher-modal-close"
                onClick={() => {
                  resetPasswordForm();
                  setShowPasswordModal(false);
                }}
              >
                <FaTimes />
              </button>
            </div>

            {passwordMsg.text && (
              <div className={`teacher-modal-alert ${passwordMsg.type}`}>
                {passwordMsg.type === "success" ? <FaCheckCircle /> : <FaExclamationCircle />}
                <span>{passwordMsg.text}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="teacher-modal-form">
              <div className="teacher-form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  name="currentPassword"
                  className="teacher-modern-input"
                  placeholder="Enter your current password"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordInputChange}
                  required
                />
              </div>

              <div className="teacher-form-group">
                <label>New Password</label>
                <input
                  type="password"
                  name="newPassword"
                  className="teacher-modern-input"
                  placeholder="Minimum 6 characters"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordInputChange}
                  required
                />
              </div>

              <div className="teacher-form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  className="teacher-modern-input"
                  placeholder="Re-enter new password"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordInputChange}
                  required
                />
              </div>

              <div className="teacher-modal-actions">
                <button
                  type="button"
                  className="teacher-action-btn secondary"
                  onClick={() => {
                    resetPasswordForm();
                    setShowPasswordModal(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="teacher-action-btn primary"
                  disabled={changingPassword}
                >
                  {changingPassword ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
