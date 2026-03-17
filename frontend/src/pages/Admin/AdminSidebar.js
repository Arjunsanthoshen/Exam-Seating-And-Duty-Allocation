import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  FaCalendarAlt, FaCheckCircle, FaUser, FaUsers, 
  FaDoorOpen, FaRegClock, FaChair, FaClipboardList, 
  FaFileAlt, FaInbox, FaSignOutAlt 
} from "react-icons/fa";
import axios from "axios";
import "./AdminSidebar.css";

const AdminSidebar = () => {
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const fetchUnreadCount = async () => {
      if (location.pathname === "/Requests") {
        return;
      }

      try {
        const response = await axios.get("http://localhost:5000/api/admin/requests/unread-count");
        if (isMounted) {
          setUnreadCount(Number(response.data.unreadCount || 0));
        }
      } catch (error) {
        console.error("Failed to fetch unread requests count", error);
      }
    };

    fetchUnreadCount();
    const intervalId = window.setInterval(fetchUnreadCount, 15000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname !== "/Requests") {
      return;
    }

    axios.post("http://localhost:5000/api/admin/requests/mark-read")
      .then(() => {
        setUnreadCount(0);
      })
      .catch((error) => {
        console.error("Failed to mark requests as read", error);
      });
  }, [location.pathname]);

  const renderNavItem = (path, icon, label) => {
    const isActive = location.pathname === path;
    const showBadge = path === "/Requests" && unreadCount > 0 && !isActive;
    const content = (
      <>
        {icon}
        <span>{label}</span>
        {showBadge ? <span className="nav-badge">{unreadCount}</span> : null}
      </>
    );

    return isActive ? (
      <div className="nav-item active">
        {content}
      </div>
    ) : (
      <Link to={path} className="nav-item">
        {content}
      </Link>
    );
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <FaCalendarAlt className="header-icon" />
        <span>Exam Seating & Duty</span>
      </div>
      
      <nav className="sidebar-nav">
        <div className="nav-menu-items">
          {renderNavItem("/ExamStatusBoard", <FaCheckCircle className="nav-icon" />, "Exam Status Board")}
          {renderNavItem("/ManageStudents", <FaUser className="nav-icon" />, "Manage Students")}
          {renderNavItem("/ManageTeachers", <FaUsers className="nav-icon" />, "Manage Teachers")}
          {renderNavItem("/ManageRooms", <FaDoorOpen className="nav-icon" />, "Manage Rooms")}
          {renderNavItem("/ExamSchedule", <FaRegClock className="nav-icon" />, "Exam Schedule")}
          {renderNavItem("/GenerateSeating", <FaChair className="nav-icon" />, "Generate Seating")}
          {renderNavItem("/GenerateDuties", <FaClipboardList className="nav-icon" />, "Generate Duties")}
          {renderNavItem("/Reports", <FaFileAlt className="nav-icon" />, "Reports")}
          {renderNavItem("/Requests", <FaInbox className="nav-icon" />, "Requests")}
        </div>

        <Link to="/" className="nav-item logout-item">
          <FaSignOutAlt className="nav-icon" /> <span>Logout</span>
        </Link>
      </nav>
    </aside>
  );
};

export default AdminSidebar;
