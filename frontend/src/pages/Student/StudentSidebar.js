import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FaGraduationCap,
  FaBuilding,
  FaCalendarAlt,
  FaUser,
  FaSignOutAlt
} from 'react-icons/fa';
import './StudentSidebar.css';

const StudentSidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const username = localStorage.getItem('username') || 'Student';

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('username');
        navigate('/login');
    };

    const isActive = (path) => location.pathname === path ? 'active' : '';

    return (
        <aside className="student-sidebar">
            <div className="student-sidebar-brand">
                <div className="student-brand-icon-box">
                    <FaGraduationCap className="student-brand-icon" />
                </div>
                <div className="student-brand-info">
                    <span className="student-portal-tag">STUDENT PORTAL</span>
                    <h3>Exam Desk</h3>
                </div>
            </div>

            <nav className="student-nav-group">
                {/* Exam Hall */}
                <button 
                    type="button"
                    className={`student-nav-item ${isActive('/ExamHall')}`} 
                    onClick={() => navigate('/ExamHall')}
                >
                    <FaBuilding className="student-nav-icon" />
                    <span>My Exam Hall</span>
                </button>

                {/* Exam Timetable */}
                <button 
                    type="button"
                    className={`student-nav-item ${isActive('/ExamTimeTable')}`} 
                    onClick={() => navigate('/ExamTimeTable')}
                >
                    <FaCalendarAlt className="student-nav-icon" />
                    <span>Exam Timetable</span>
                </button>

                {/* Profile */}
                <button 
                    type="button"
                    className={`student-nav-item ${isActive('/StudentProfile')}`} 
                    onClick={() => navigate('/StudentProfile')}
                >
                    <FaUser className="student-nav-icon" />
                    <span>My Profile</span>
                </button>
            </nav>

            <div className="student-sidebar-footer">
                <div className="student-user-chip">
                    <div className="student-avatar">
                        {username.charAt(0).toUpperCase()}
                    </div>
                    <div className="student-user-details">
                        <span className="student-user-name" title={username}>{username}</span>
                        <span className="student-user-role">Student</span>
                    </div>
                </div>

                <button type="button" className="student-logout-btn" onClick={handleLogout}>
                    <FaSignOutAlt className="student-nav-icon" />
                    <span>Sign Out</span>
                </button>
            </div>
        </aside>
    );
};

export default StudentSidebar;