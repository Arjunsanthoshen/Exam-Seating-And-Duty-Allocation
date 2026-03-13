import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import StudentSidebar from './StudentSidebar';
import './ExamHall.css'; // Reuse common layout styles

const StudentProfile = () => {
    const navigate = useNavigate();
    const [profile, setProfile] = useState({});
    const [loading, setLoading] = useState(true);

    const checkAuth = useCallback(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return null;
        }
        return token;
    }, [navigate]);

    useEffect(() => {
        const token = checkAuth();
        if (!token) return;

        const config = { headers: { Authorization: `Bearer ${token}` } };

        axios.get('http://localhost:5000/api/student/profile', config)
            .then(res => {
                setProfile(res.data);
                setLoading(false);
            })
            .catch(err => {
                if (err.response && (err.response.status === 401 || err.response.status === 403)) {
                    localStorage.removeItem('token');
                    navigate('/login');
                }
            });
    }, [navigate, checkAuth]);

    if (loading) return <div className="loading-screen">Loading Profile...</div>;

    return (
        <div className="studashboard-container">
            <StudentSidebar />
            <main className="main-content">
                <header className="top-bar">
                    <h2>Student Profile</h2>
                </header>
                <div className="content-card">
                    <div className="profile-details">
                        <p><strong>Username:</strong> {profile.username}</p>
                        <p><strong>Branch:</strong> {profile.branch}</p>
                        <p><strong>Batch:</strong> {profile.batch}</p>
                        <p><strong>Year of Join:</strong> {profile.year_of_join}</p>
                        <p><strong>Roll Number:</strong> {profile.roll_no}</p>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default StudentProfile;