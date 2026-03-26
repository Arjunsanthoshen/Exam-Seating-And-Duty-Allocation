import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './StudentSidebar.css';

const StudentSidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        // 1. Clear the token
        localStorage.removeItem('token');
        
        // 2. Point to "/" because that's where Login is in your App.js
        // Using window.location.href ensures a clean refresh on logout
        window.location.href = '/'; 
    };

    const isActive = (path) => location.pathname === path ? 'active' : '';

    return (
        <aside className="student-sidebar">
            <div className="student-nav-label">
                <span>🎓</span> Student Portal
            </div>

            <div className="student-nav-group">
                {/* Exam Hall */}
                <button 
                    className={`student-nav-item ${isActive('/ExamHall')}`} 
                    onClick={() => navigate('/ExamHall')}
                >
                    <span className="student-nav-icon">🏢</span> Exam Hall
                </button>

                {/* Exam Timetable - Corrected path to match App.js (/ExamTimeTable) */}
                <button 
                    className={`student-nav-item ${isActive('/ExamTimeTable')}`} 
                    onClick={() => navigate('/ExamTimeTable')}
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