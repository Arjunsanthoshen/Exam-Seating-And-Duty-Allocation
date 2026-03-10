import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import StudentSidebar from './StudentSidebar'; // Import here
import './ExamHall.css';

const Dashboard = () => {
    const navigate = useNavigate();
    const [profile, setProfile] = useState({});
    const [seating, setSeating] = useState([]);
    const [view, setView] = useState('exam_hall');
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

        const fetchData = async () => {
            try {
                const profileRes = await axios.get('http://localhost:5000/api/student/profile', config);
                setProfile(profileRes.data);

                const seatingRes = await axios.get('http://localhost:5000/api/student/seating', config);
                  console.log("Frontend seating data received:", seatingRes.data); // Should be an array []
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

    if (loading) return <div className="loading-screen">Loading Dashboard...</div>;

    return (
        <div className="studashboard-container">
            {/* Using the new Sidebar Component */}
            <StudentSidebar view={view} setView={setView} />

            <main className="main-content">
                <header className="top-bar">
                    <h2>Roll Number: {profile.roll_no || profile.username || "N/A"}</h2>
                </header>

                <div className="content-card">
                    {view === 'exam_hall' ? (
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
                    ) : (
                        <div className="profile-details">
                            <p><strong>Username:</strong> {profile.username}</p>
                            <p><strong>Branch:</strong> {profile.branch}</p>
                            <p><strong>Batch:</strong> {profile.batch}</p>
                            <p><strong>Year of Join:</strong> {profile.year_of_join}</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Dashboard;