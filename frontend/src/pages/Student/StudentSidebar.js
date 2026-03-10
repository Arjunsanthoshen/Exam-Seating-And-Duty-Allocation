import React from 'react';
import { useNavigate } from 'react-router-dom';
import './StudentSidebar.css';

const StudentSidebar = ({ view, setView }) => {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    return (
        <aside className="student-sidebar">
            <div className="student-nav-label">
                <span>🎓</span> Student Portal
            </div>

            <div className="student-nav-group">
                <button 
                    className={`student-nav-item ${view === 'exam_hall' ? 'active' : ''}`} 
                    onClick={() => setView('exam_hall')}
                >
                    <span className="student-nav-icon">👤</span> Exam Hall
                </button>

                <button 
                    className={`student-nav-item ${view === 'profile' ? 'active' : ''}`} 
                    onClick={() => setView('profile')}
                >
                    <span className="student-nav-icon">📅</span> Profile
                </button>
            </div>

            <button className="student-logout-btn" onClick={handleLogout}>
                <span className="student-nav-icon">⏻</span> Logout
            </button>
        </aside>
    );
};

export default StudentSidebar;