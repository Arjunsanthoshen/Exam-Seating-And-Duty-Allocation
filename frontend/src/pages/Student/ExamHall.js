import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import StudentSidebar from './StudentSidebar';
import './ExamHall.css';

const ExamHall = () => {
    const navigate = useNavigate();
    const [seating, setSeating] = useState([]);
    const [loading, setLoading] = useState(true);
    const [rollNo, setRollNo] = useState("");

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

        const fetchData = async () => {
            try {
                // Fetch profile just for the header roll number, and seating data
                const [profileRes, seatingRes] = await Promise.all([
                    axios.get('http://localhost:5000/api/student/profile', config),
                    axios.get('http://localhost:5000/api/student/seating', config)
                ]);
                
                setRollNo(profileRes.data.roll_no || profileRes.data.username);
                setSeating(seatingRes.data);
                setLoading(false);
            } catch (err) {
                if (err.response && (err.response.status === 401 || err.response.status === 403)) {
                    localStorage.removeItem('token');
                    navigate('/login');
                }
            }
        };
        fetchData();
    }, [navigate, checkAuth]);

    if (loading) return <div className="loading-screen">Loading Exam Hall...</div>;

    return (
        <div className="studashboard-container">
            <StudentSidebar />
            <main className="main-content">
                <header className="top-bar">
                    <h2>Roll Number: {rollNo}</h2>
                </header>
                <div className="content-card">
                    <div className="seating-info">
                        {seating.length > 0 ? (
                            seating.map((s, i) => (
                                <div key={i} className="info-row-container">
                                    <div className="info-row"><span>📅 Date: 24/01/26</span></div>
                                    <div className="info-row"><span>🏢 Hall: {s.block} {s.room_no}</span></div>
                                    <div className="info-row"><span>👥 Session: {s.session}</span></div>
                                </div>
                            ))
                        ) : (
                            <div className="info-row">No seating allocation found.</div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ExamHall;