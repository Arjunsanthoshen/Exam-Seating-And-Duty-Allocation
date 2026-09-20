import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  FaCheckCircle, FaUser, FaUsers, 
  FaDoorOpen, FaRegClock, FaChair, FaClipboardList, 
  FaFileAlt, FaInbox, FaSignOutAlt, FaShieldAlt
} from "react-icons/fa";
import axios from "axios";
import { API_BASE_URL } from "../../api/config";
import "./AdminSidebar.css";

const AdminSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const fetchCounts = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/admin/requests/unread-count`);
        if (isMounted) {
          setPendingCount(Number(response.data.pendingCount || response.data.unreadCount || 0));
        }
      } catch (error) {
        console.error("Failed to fetch requests count", error);
      }
    };

    fetchCounts();
    const intervalId = window.setInterval(fetchCounts, 15000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [location.pathname]);

  const renderNavItem = (path, icon, label) => {
    const isActive = location.pathname === path;
    const showBadge = path === "/Requests" && pendingCount > 0;
    const content = (
      <>
        <span className="admin-nav-icon">{icon}</span>
        <span className="admin-nav-label">{label}</span>
        {showBadge ? <span className="nav-badge-sm">{pendingCount}</span> : null}
      </>
    );

    return isActive ? (
      <div className="admin-nav-item active">
        {content}
      </div>
    ) : (
      <Link to={path} className="admin-nav-item">
        {content}
      </Link>
    );
  };

  const handleLogout = (e) => {
    e.preventDefault();
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    navigate("/login");
  };

  const username = localStorage.getItem("username") || "";
  const isDemoUser = localStorage.getItem("isDemo") === "true" || username.toLowerCase() === "demo";

  // Cleanup Modal States (Real Admin Only)
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [confirmCode, setConfirmCode] = useState("");
  const [cleanupError, setCleanupError] = useState("");
  const [isPurging, setIsPurging] = useState(false);
  const [cleanupSuccessMsg, setCleanupSuccessMsg] = useState("");

  const handleOpenCleanup = () => {
    if (isDemoUser) return;
    setShowCleanupModal(true);
    setConfirmCode("");
    setCleanupError("");
    setCleanupSuccessMsg("");
    setIsPurging(false);
  };

  const handleCloseCleanup = () => {
    setShowCleanupModal(false);
    setConfirmCode("");
    setCleanupError("");
    setCleanupSuccessMsg("");
    setIsPurging(false);
  };

  const handleExecutePurge = async (e) => {
    if (e) e.preventDefault();
    if (confirmCode !== "+") {
      setCleanupError("Please enter '+' to authorize demo data deletion.");
      return;
    }
    setIsPurging(true);
    setCleanupError("");
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_BASE_URL}/api/admin/demo-cleanup`,
        { confirmationCode: "+" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCleanupSuccessMsg(res.data.message || "All demo-created data purged successfully.");
      setTimeout(() => {
        handleCloseCleanup();
        window.location.reload();
      }, 1800);
    } catch (err) {
      setCleanupError(err.response?.data?.message || "Failed to purge demo data.");
      setIsPurging(false);
    }
  };

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <div 
          className={`admin-brand-icon-box ${!isDemoUser ? "clickable-shield" : ""}`}
          onClick={!isDemoUser ? handleOpenCleanup : undefined}
          title={!isDemoUser ? "System Maintenance & Demo Cleanup" : undefined}
        >
          <FaShieldAlt className="admin-brand-icon" />
        </div>
        <div className="admin-brand-info">
          <span className="admin-portal-tag">ADMINISTRATION</span>
          <h3>Exam Operations</h3>
        </div>
      </div>
      
      <nav className="admin-sidebar-nav">
        <div className="admin-menu-items">
          <div className="admin-menu-section-label">MONITORING</div>
          {renderNavItem("/ExamStatusBoard", <FaCheckCircle />, "Exam Status Board")}

          <div className="admin-menu-section-label">MANAGEMENT</div>
          {renderNavItem("/ManageStudents", <FaUser />, "Manage Students")}
          {renderNavItem("/ManageTeachers", <FaUsers />, "Manage Teachers")}
          {renderNavItem("/ManageRooms", <FaDoorOpen />, "Manage Rooms")}
          {renderNavItem("/ExamSchedule", <FaRegClock />, "Exam Schedule")}

          <div className="admin-menu-section-label">ALLOCATION ENGINE</div>
          {renderNavItem("/GenerateSeating", <FaChair />, "Generate Seating")}
          {renderNavItem("/GenerateDuties", <FaClipboardList />, "Generate Duties")}

          <div className="admin-menu-section-label">REPORTS & REQUESTS</div>
          {renderNavItem("/Reports", <FaFileAlt />, "Reports & Exports")}
          {renderNavItem("/Requests", <FaInbox />, "Faculty Requests")}
        </div>

        <div className="admin-sidebar-footer">
          <div className="admin-user-chip">
            <div className="admin-avatar">
              {isDemoUser ? "DM" : "AD"}
            </div>
            <div className="admin-user-details">
              <span className="admin-user-name">
                {isDemoUser ? "Demo Administrator" : "Administrator"}
              </span>
              <span className="admin-user-role">
                {isDemoUser ? "Restricted Demo Mode" : "Exam Controller"}
              </span>
            </div>
            {!isDemoUser && (
              <button
                type="button"
                className="admin-cleanup-trigger-btn"
                title="Purge Demo Data"
                onClick={handleOpenCleanup}
              >
                <FaShieldAlt />
              </button>
            )}
          </div>
          <button type="button" onClick={handleLogout} className="admin-logout-btn">
            <FaSignOutAlt className="admin-nav-icon" /> <span>Sign Out</span>
          </button>
        </div>
      </nav>

      {/* Real Admin Demo Cleanup Centered Modal */}
      {showCleanupModal && !isDemoUser && createPortal(
        <div className="admin-cleanup-modal-overlay" onClick={handleCloseCleanup}>
          <div className="admin-cleanup-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-cleanup-modal-head">
              <div className="admin-cleanup-title-row">
                <div className="admin-cleanup-icon-shield">
                  <FaShieldAlt />
                </div>
                <div>
                  <h4>Demo Data Maintenance</h4>
                  <p>Real Administrator Purge Control</p>
                </div>
              </div>
              <button 
                type="button" 
                className="admin-cleanup-close" 
                onClick={handleCloseCleanup}
                disabled={isPurging}
                title="Close"
              >
                ✕
              </button>
            </div>

            {cleanupSuccessMsg ? (
              <div className="admin-cleanup-success-msg">
                <FaCheckCircle />
                <span>{cleanupSuccessMsg}</span>
              </div>
            ) : (
              <form onSubmit={handleExecutePurge} className="admin-cleanup-step-body">
                <div className="admin-cleanup-warning-box">
                  <strong>Permanent Action Warning</strong>
                  <p>
                    Are you sure you want to proceed? <strong>All demo-created data will be permanently deleted.</strong>
                  </p>
                  <ul>
                    <li>All demo seating allocations and history will be cleared.</li>
                    <li>All demo duty allocations and demo PDF reports will be erased.</li>
                    <li>Demo teacher requests and demo exam slots will be deleted.</li>
                    <li>Real examination records and permanent demo accounts will remain safe.</li>
                  </ul>
                </div>

                <p className="admin-cleanup-instruction" style={{ textAlign: "center", marginBottom: "10px" }}>
                  Enter <strong>+</strong> in the box below to authorize deletion:
                </p>

                <div className="admin-cleanup-input-wrap">
                  <input
                    type="text"
                    className="admin-cleanup-input"
                    maxLength={1}
                    value={confirmCode}
                    onChange={(e) => {
                      setConfirmCode(e.target.value);
                      setCleanupError("");
                    }}
                    placeholder="+"
                    autoFocus
                    required
                  />
                </div>

                {cleanupError && (
                  <div className="admin-cleanup-error-alert">
                    {cleanupError}
                  </div>
                )}

                <div className="admin-cleanup-btn-row">
                  <button 
                    type="button" 
                    className="admin-cleanup-btn-cancel" 
                    onClick={handleCloseCleanup}
                    disabled={isPurging}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="admin-cleanup-btn-danger" 
                    disabled={isPurging || confirmCode !== "+"}
                  >
                    {isPurging ? "Purging Demo Data..." : "OK"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </aside>
  );
};

export default AdminSidebar;
