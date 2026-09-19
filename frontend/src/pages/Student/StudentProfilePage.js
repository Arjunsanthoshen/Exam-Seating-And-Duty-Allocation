import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  FaUserGraduate,
  FaIdBadge,
  FaBuilding,
  FaUsers,
  FaCalendarAlt,
  FaCheckCircle
} from 'react-icons/fa';
import StudentSidebar from './StudentSidebar';
import './ExamHall.css';

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
                setProfile(res.data || {});
                setLoading(false);
            })
            .catch(err => {
                if (err.response && (err.response.status === 401 || err.response.status === 403)) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('role');
                    localStorage.removeItem('username');
                    navigate('/login');
                } else {
                    setLoading(false);
                }
            });
    }, [navigate, checkAuth]);

    if (loading) {
        return (
            <div className="studashboard-container">
                <StudentSidebar />
                <main className="main-content">
                    <div className="student-loading-card">
                        <div className="student-loading-spinner"></div>
                        <p>Loading student credentials...</p>
                    </div>
                </main>
            </div>
        );
    }

    const initials = (profile.username || "ST").substring(0, 2).toUpperCase();

    return (
        <div className="studashboard-container">
            <StudentSidebar />
            <main className="main-content">
                <header className="student-top-bar" style={{ maxWidth: '900px' }}>
                    <div className="student-header-left">
                        <div className="student-portal-pill">
                            <FaUserGraduate /> VERIFIED ENROLMENT
                        </div>
                        <h2>Student Profile</h2>
                        <p className="student-subhead">Official academic record and student credentials</p>
                    </div>
                </header>

                <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderRadius: '24px',
                    padding: '36px',
                    boxShadow: '0 20px 45px -15px rgba(0, 0, 0, 0.5), 0 0 1px 1px rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    width: '100%',
                    maxWidth: '900px',
                    boxSizing: 'border-box'
                }}>
                    {/* Modern ID Banner */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '24px',
                        paddingBottom: '28px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                        marginBottom: '32px',
                        flexWrap: 'wrap'
                    }}>
                        <div style={{
                            width: '82px',
                            height: '82px',
                            borderRadius: '20px',
                            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '2rem',
                            fontWeight: '800',
                            boxShadow: '0 12px 24px rgba(2, 132, 199, 0.35)'
                        }}>
                            {initials}
                        </div>

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <h3 style={{ margin: 0, fontSize: '1.65rem', fontWeight: '800', color: '#ffffff' }}>
                                    {profile.username || "Student"}
                                </h3>
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: 'rgba(34, 197, 94, 0.18)',
                                    color: '#4ade80',
                                    border: '1px solid rgba(34, 197, 94, 0.35)',
                                    padding: '4px 12px',
                                    borderRadius: '999px',
                                    fontSize: '0.78rem',
                                    fontWeight: '800'
                                }}>
                                    <FaCheckCircle /> Enrolled
                                </span>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                <span style={{
                                    background: 'rgba(14, 165, 233, 0.15)',
                                    color: '#38bdf8',
                                    border: '1px solid rgba(56, 189, 248, 0.3)',
                                    padding: '6px 14px',
                                    borderRadius: '8px',
                                    fontSize: '0.85rem',
                                    fontWeight: '700'
                                }}>
                                    {profile.branch || "Department"} • Batch {profile.batch || "A"}
                                </span>
                                <span style={{
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    color: '#cbd5e1',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    padding: '6px 14px',
                                    borderRadius: '8px',
                                    fontSize: '0.85rem',
                                    fontWeight: '600'
                                }}>
                                    Joined Year: {profile.year_of_join || "2025"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 4-Card Academic Grid: 2 in first row, 2 in next */}
                    <div className="student-profile-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '20px'
                    }}>
                        <div style={{
                            background: 'rgba(255, 255, 255, 0.04)',
                            padding: '24px',
                            borderRadius: '16px',
                            border: '1.5px solid rgba(255, 255, 255, 0.08)',
                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontSize: '0.82rem', fontWeight: '800', letterSpacing: '0.06em', marginBottom: '10px' }}>
                                <FaIdBadge /> ROLL NUMBER
                            </div>
                            <div style={{ fontSize: '1.45rem', color: '#f8fafc', fontWeight: '800' }}>
                                #{profile.roll_no || "01"}
                            </div>
                        </div>

                        <div style={{
                            background: 'rgba(255, 255, 255, 0.04)',
                            padding: '24px',
                            borderRadius: '16px',
                            border: '1.5px solid rgba(255, 255, 255, 0.08)',
                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontSize: '0.82rem', fontWeight: '800', letterSpacing: '0.06em', marginBottom: '10px' }}>
                                <FaBuilding /> DEPARTMENT
                            </div>
                            <div style={{ fontSize: '1.45rem', color: '#f8fafc', fontWeight: '800' }}>
                                {profile.branch || "-"}
                            </div>
                        </div>

                        <div style={{
                            background: 'rgba(255, 255, 255, 0.04)',
                            padding: '24px',
                            borderRadius: '16px',
                            border: '1.5px solid rgba(255, 255, 255, 0.08)',
                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontSize: '0.82rem', fontWeight: '800', letterSpacing: '0.06em', marginBottom: '10px' }}>
                                <FaUsers /> ASSIGNED BATCH
                            </div>
                            <div style={{ fontSize: '1.45rem', color: '#f8fafc', fontWeight: '800' }}>
                                Batch {profile.batch || "A"}
                            </div>
                        </div>

                        <div style={{
                            background: 'rgba(255, 255, 255, 0.04)',
                            padding: '24px',
                            borderRadius: '16px',
                            border: '1.5px solid rgba(255, 255, 255, 0.08)',
                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontSize: '0.82rem', fontWeight: '800', letterSpacing: '0.06em', marginBottom: '10px' }}>
                                <FaCalendarAlt /> ADMISSION YEAR
                            </div>
                            <div style={{ fontSize: '1.45rem', color: '#f8fafc', fontWeight: '800' }}>
                                {profile.year_of_join || "-"}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default StudentProfile;