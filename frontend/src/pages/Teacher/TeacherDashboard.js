import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FaCalendarAlt,
  FaClipboardList,
  FaKey,
  FaPowerOff,
  FaTimes
} from "react-icons/fa";
import "./TeacherDashboard.css";

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const getLocalDateValue = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split("T")[0];
  };
  const [teacherName, setTeacherName] = useState("Teacher");
  const [duties, setDuties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
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
    const timer = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    axios
      .get("http://localhost:5000/api/teacher/dashboard", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      .then((response) => {
        setTeacherName(response.data.teacher?.name || "Teacher");
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
  };

  const resetPasswordForm = () => {
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    });
  };

  const togglePasswordForm = () => {
    setShowPasswordForm((current) => {
      const nextValue = !current;
      if (!nextValue) {
        resetPasswordForm();
      }
      return nextValue;
    });
  };

  const handlePasswordSubmit = (event) => {
    event.preventDefault();

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      window.alert("New password and retype password must match.");
      return;
    }

    setChangingPassword(true);

    axios.post(
      "http://localhost:5000/api/teacher/change-password",
      passwordForm,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    ).then((response) => {
      window.alert(response.data?.message || "Password changed successfully.");
      resetPasswordForm();
      setShowPasswordForm(false);
    }).catch((error) => {
      const message = error.response?.data?.message || "Failed to change password.";
      window.alert(message);
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
      window.alert("Reason too long make it shorter");
      return;
    }

    setSubmittingRequest(true);

    axios.post(
      "http://localhost:5000/api/teacher/unavailability",
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    ).then(() => {
      window.alert("Unavailability request submitted successfully.");
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
    return <div className="teacher-loading">Loading teacher dashboard...</div>;
  }

  return (
    <div className="teacher-dashboard">
      <aside className="teacher-sidebar">
        <div className="teacher-sidebar-top">
          <button
            type="button"
            className={`teacher-nav-item ${activeSection === "schedule" ? "active" : ""}`}
            onClick={() => navigate("/MyDutySchedule")}
          >
            <FaClipboardList className="teacher-nav-icon" />
            <span>My Duty Schedule</span>
          </button>

          <button
            type="button"
            className={`teacher-nav-item ${activeSection === "unavailability" ? "active" : ""}`}
            onClick={() => navigate("/MarkUnavailability")}
          >
            <FaTimes className="teacher-nav-icon" />
            <span>Mark Unavailability</span>
          </button>
        </div>

        <button type="button" className="teacher-logout-btn" onClick={handleLogout}>
          <FaPowerOff className="teacher-nav-icon" />
          <span>Logout</span>
        </button>
      </aside>

      <main className="teacher-main">
        {activeSection === "schedule" ? (
          <>
            <header className="teacher-header">
              <div className="teacher-header-main">
                <div className="teacher-header-top-row">
                  <h1>Welcome, {teacherName}</h1>
                  <button
                    type="button"
                    className="teacher-change-password-btn"
                    onClick={togglePasswordForm}
                  >
                    <FaKey className="teacher-nav-icon" />
                    <span>{showPasswordForm ? "Close" : "Change Password"}</span>
                  </button>
                </div>

                {showPasswordForm ? (
                  <form className="teacher-password-form" onSubmit={handlePasswordSubmit}>
                    <div className="teacher-password-grid">
                      <label className="teacher-field">
                        <span>Type your current password</span>
                        <input
                          type="password"
                          name="currentPassword"
                          value={passwordForm.currentPassword}
                          onChange={handlePasswordInputChange}
                          required
                        />
                      </label>

                      <label className="teacher-field">
                        <span>Type your new password</span>
                        <input
                          type="password"
                          name="newPassword"
                          value={passwordForm.newPassword}
                          onChange={handlePasswordInputChange}
                          required
                        />
                      </label>

                      <label className="teacher-field">
                        <span>Retype your new password</span>
                        <input
                          type="password"
                          name="confirmPassword"
                          value={passwordForm.confirmPassword}
                          onChange={handlePasswordInputChange}
                          required
                        />
                      </label>
                    </div>

                    <div className="teacher-password-actions">
                      <button type="submit" className="teacher-submit-btn" disabled={changingPassword}>
                        {changingPassword ? "Updating..." : "Update Password"}
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>

              <div className="teacher-datetime">
                <span>{currentTime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
                <span>{currentTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })} IST</span>
              </div>
            </header>

            <section className="teacher-card">
              <h2>My Duty Schedule</h2>
              <div className="teacher-table-wrap">
                <table className="teacher-table">
                  <thead>
                    <tr>
                      <th>Exam Date</th>
                      <th>Session</th>
                      <th>Exam Hall</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duties.length > 0 ? (
                      duties.map((duty, index) => (
                        <tr key={`${duty.exam_date}-${duty.session}-${duty.exam_hall}-${index}`}>
                          <td>{formatDisplayDate(duty.exam_date)}</td>
                          <td>{duty.session}</td>
                          <td>{duty.exam_hall}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="3" className="teacher-empty">
                          No duty allocations found.
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
            <header className="teacher-header teacher-header-title-only">
              <h1>Mark Unavailability</h1>
            </header>

            <section className="teacher-card teacher-form-card">
              <form className="teacher-form" onSubmit={handleUnavailabilitySubmit}>
                <div className="teacher-form-grid">
                  <label className="teacher-field">
                    <span>Exam Date</span>
                    <div className="teacher-date-input">
                      <input
                        type="date"
                        name="examDate"
                        value={formData.examDate}
                        onChange={handleFormChange}
                        required
                      />
                      <FaCalendarAlt className="teacher-input-icon" />
                    </div>
                  </label>

                  <label className="teacher-field">
                    <span>Session</span>
                    <select
                      name="session"
                      value={formData.session}
                      onChange={handleFormChange}
                      required
                    >
                      <option value="FN">FN</option>
                      <option value="AN">AN</option>
                      <option value="Both">Both</option>
                    </select>
                  </label>
                </div>

                <label className="teacher-field teacher-field-full">
                  <span>Reason</span>
                  <small className="teacher-field-hint">
                    Write your message in limited words. Maximum 40 words.
                  </small>
                  <textarea
                    name="reason"
                    value={formData.reason}
                    onChange={handleFormChange}
                    rows="4"
                    placeholder="Enter the reason for unavailability"
                    required
                  />
                  <div className={`teacher-word-count ${isReasonTooLong ? "error" : ""}`}>
                    <span>{reasonWordCount}/40 words</span>
                    {isReasonTooLong ? <span>Reason too long make it shorter</span> : null}
                  </div>
                </label>

                <button type="submit" className="teacher-submit-btn" disabled={submittingRequest || isReasonTooLong}>
                  {submittingRequest ? "Submitting..." : "Submit"}
                </button>
              </form>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default TeacherDashboard;
