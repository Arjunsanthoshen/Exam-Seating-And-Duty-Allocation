import React from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  FaCalendarAlt, FaCheckCircle, FaUser, FaUsers, 
  FaDoorOpen, FaRegClock, FaChair, FaClipboardList, 
  FaFileAlt, FaSignOutAlt 
} from "react-icons/fa";
import "./AdminSidebar.css";

const AdminSidebar = () => {
  const location = useLocation();

  const renderNavItem = (path, icon, label) => {
    const isActive = location.pathname === path;

    return isActive ? (
      <div className="nav-item active">
        {icon} <span>{label}</span>
      </div>
    ) : (
      <Link to={path} className="nav-item">
        {icon} <span>{label}</span>
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
        </div>

        <Link to="/" className="nav-item logout-item">
          <FaSignOutAlt className="nav-icon" /> <span>Logout</span>
        </Link>
      </nav>
    </aside>
  );
};

export default AdminSidebar;