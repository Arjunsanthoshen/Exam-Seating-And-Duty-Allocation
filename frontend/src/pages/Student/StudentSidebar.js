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
        <aside className="sidebar">
            <div className="nav-group">
                <p className="nav-label">Dashboard</p>
                <button 
                    className={view === 'exam_hall' ? 'active' : ''} 
                    onClick={() => setView('exam_hall')}
                >
                    <span className="icon">👤</span> Exam Hall
                </button>
                <button 
                    className={view === 'profile' ? 'active' : ''} 
                    onClick={() => setView('profile')}
                >
                    <span className="icon">📅</span> Profile
                </button>
                {/* You can easily add "Exam Schedule" here later */}
            </div>
            <button className="logout-btn" onClick={handleLogout}>
                <span className="icon">⏻</span> Logout
            </button>
        </aside>
    );
};

export default StudentSidebar;