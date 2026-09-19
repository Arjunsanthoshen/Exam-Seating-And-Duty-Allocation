import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  FaCheckCircle, FaUser, FaUsers, 
  FaDoorOpen, FaRegClock, FaChair, FaClipboardList, 
  FaFileAlt, FaInbox, FaSignOutAlt, FaShieldAlt
} from "react-icons/fa";
import axios from "axios";
import "./AdminSidebar.css";

const AdminSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const fetchCounts = async () => {
      try {
        const response = await axios.get("http://localhost:5000/api/admin/requests/unread-count");
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

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <div className="admin-brand-icon-box">
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
            <div className="admin-avatar">AD</div>
            <div className="admin-user-details">
              <span className="admin-user-name">Administrator</span>
              <span className="admin-user-role">Exam Controller</span>
            </div>
          </div>
          <button type="button" onClick={handleLogout} className="admin-logout-btn">
            <FaSignOutAlt className="admin-nav-icon" /> <span>Sign Out</span>
          </button>
        </div>
      </nav>
    </aside>
  );
};

export default AdminSidebar;
