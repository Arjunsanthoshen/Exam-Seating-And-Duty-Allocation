import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './StudentSidebar.css';

const StudentSidebar = () => {
    const navigate = useNavigate();
    const location = useLocation(); // Checks the current URL to highlight the active button

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    // Helper function to check if a path is active
    const isActive = (path) => location.pathname === path ? 'active' : '';

    return (
        <aside className="student-sidebar">
            <div className="student-nav-label">
                <span>🎓</span> Student Portal
            </div>

            <div className="student-nav-group">
                {/* Exam Hall - This is your landing page */}
                <button 
                    className={`student-nav-item ${isActive('/ExamHall')}`} 
                    onClick={() => navigate('/ExamHall')}
                >
                    <span className="student-nav-icon">🏢</span> Exam Hall
                </button>

                {/* Exam Timetable */}
                <button 
                    className={`student-nav-item ${isActive('/ExamTimetable')}`} 
                    onClick={() => navigate('/ExamTimetable')}
                >
                    <span className="student-nav-icon">📅</span> Timetable
                </button>

                {/* Profile */}
                <button 
                    className={`student-nav-item ${isActive('/StudentProfile')}`} 
                    onClick={() => navigate('/StudentProfile')}
                >
                    <span className="student-nav-icon">👤</span> Profile
                </button>
            </div>

            <button className="student-logout-btn" onClick={handleLogout}>
                <span className="student-nav-icon">⏻</span> Logout
            </button>
        </aside>
    );
};

export default StudentSidebar;