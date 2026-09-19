import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  FaCalendarAlt,
  FaBuilding,
  FaChair,
  FaUserGraduate,
  FaClock,
  FaBookOpen,
  FaIdBadge
} from 'react-icons/fa';
import StudentSidebar from './StudentSidebar';
import './ExamHall.css';

const ExamHall = () => {
    const navigate = useNavigate();
    const [seating, setSeating] = useState([]);
    const [loading, setLoading] = useState(true);
    const [_studentName, setStudentName] = useState(""); // eslint-disable-line no-unused-vars
    const [rollNo, setRollNo] = useState("");
    const [branch, setBranch] = useState("");

    const [activeExamIndex, setActiveExamIndex] = useState(0);

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
                const [profileRes, seatingRes] = await Promise.all([
                    axios.get('http://localhost:5000/api/student/profile', config),
                    axios.get('http://localhost:5000/api/student/seating', config)
                ]);
                
                const profile = profileRes.data || {};
                setRollNo(profile.roll_no ? `Roll #${profile.roll_no}` : (profile.username || "Student"));
                setStudentName(profile.username || "Student");
                setBranch(profile.branch ? `${profile.branch} (Batch ${profile.batch || 'A'})` : "");
                setSeating(Array.isArray(seatingRes.data) ? seatingRes.data : []);
                setLoading(false);
            } catch (err) {
                if (err.response && (err.response.status === 401 || err.response.status === 403)) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('role');
                    localStorage.removeItem('username');
                    navigate('/login');
                } else {
                    setLoading(false);
                }
            }
        };
        fetchData();
    }, [navigate, checkAuth]);

    if (loading) {
        return (
            <div className="studashboard-container">
                <StudentSidebar />
                <main className="main-content">
                    <div className="student-loading-card">
                        <div className="student-loading-spinner"></div>
                        <p>Locating exam hall seating...</p>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="studashboard-container">
            <StudentSidebar />
            <main className="main-content">
                {/* Header Banner */}
                <header className="student-top-bar">
                    <div className="student-header-left">
                        <div className="student-portal-pill">
                            <FaUserGraduate /> STUDENT EXAMINATION DESK
                        </div>
                        <h2>My Exam Hall & Seating</h2>
                        <p className="student-subhead">
                            View your verified examination room, column, and allocated bench position.
                        </p>
                    </div>

                    <div className="student-header-right">
                        <div className="student-id-pill">
                            <FaIdBadge className="student-pill-icon" />
                            <div className="student-pill-info">
                                <span className="student-pill-roll">{rollNo}</span>
                                {branch && <span className="student-pill-meta">{branch}</span>}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Seating Content */}
                <div className="student-content-card">
                    {seating.length > 0 ? (
                        (() => {
                            const currentExam = seating[activeExamIndex] || seating[0];
                            const formattedDate = currentExam.exam_date 
                                ? new Date(currentExam.exam_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                                : "Exam Slot";
                            const isLeftSeat = !currentExam.seat_position || currentExam.seat_position.toLowerCase() === 'left';

                            return (
                                <div className="expanded-hall-wrapper">
                                    {/* Multi-Exam Switcher Bar (if more than 1 exam) */}
                                    {seating.length > 1 && (
                                        <div className="exam-selector-tabs">
                                            <span className="exam-tabs-label">Your Scheduled Exams:</span>
                                            <div className="exam-tabs-list">
                                                {seating.map((s, idx) => {
                                                    const tabDate = s.exam_date 
                                                        ? new Date(s.exam_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                                        : `Exam ${idx + 1}`;
                                                    return (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            className={`exam-tab-btn ${activeExamIndex === idx ? 'active' : ''}`}
                                                            onClick={() => setActiveExamIndex(idx)}
                                                        >
                                                            <FaCalendarAlt className="tab-btn-icon" />
                                                            <div className="tab-btn-content">
                                                                <span className="tab-subject">{s.sub_code || s.subject || `Exam ${idx + 1}`}</span>
                                                                <span className="tab-date">{tabDate} ({s.session || 'FN'})</span>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Expanded Hero Hall Pass */}
                                    <div className="expanded-hall-card">
                                        {/* Card Top Banner */}
                                        <div className="expanded-card-header">
                                            <div className="expanded-header-left">
                                                <div className="hall-sub-code-tag">
                                                    <FaBookOpen />
                                                    <span>{currentExam.sub_code || "EXAM"}</span>
                                                </div>
                                                <h3 className="expanded-subject-title">
                                                    {currentExam.subject || "Course Examination"}
                                                </h3>
                                            </div>

                                            <div className="expanded-header-right">
                                                <div className="hall-date-badge">
                                                    <FaCalendarAlt className="hall-badge-icon" />
                                                    <span>{formattedDate}</span>
                                                </div>
                                                <span className={`hall-session-badge ${currentExam.session || 'FN'}`}>
                                                    <FaClock className="hall-badge-icon" />
                                                    {currentExam.session === 'FN' ? 'Forenoon (09:30 AM - 12:30 PM)' : 'Afternoon (01:30 PM - 04:30 PM)'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Primary Allocation Grid (Expansive 4-Column Metric Cards) */}
                                        <div className="hall-metrics-grid">
                                            <div className="hall-metric-box highlight-room">
                                                <div className="metric-box-icon"><FaBuilding /></div>
                                                <div className="metric-box-content">
                                                    <span className="metric-box-label">EXAMINATION ROOM</span>
                                                    <div className="metric-box-val">{currentExam.block} - {currentExam.room_no}</div>
                                                    <span className="metric-box-sub">Block: {currentExam.block}</span>
                                                </div>
                                            </div>

                                            <div className="hall-metric-box highlight-bench">
                                                <div className="metric-box-icon"><FaChair /></div>
                                                <div className="metric-box-content">
                                                    <span className="metric-box-label">BENCH NUMBER</span>
                                                    <div className="metric-box-val">Bench #{currentExam.bench_no || 1}</div>
                                                    <span className="metric-box-sub">Column {currentExam.column_no || 1}</span>
                                                </div>
                                            </div>

                                            <div className="hall-metric-box highlight-seat">
                                                <div className="metric-box-icon"><FaIdBadge /></div>
                                                <div className="metric-box-content">
                                                    <span className="metric-box-label">ALLOCATED POSITION</span>
                                                    <div className="metric-box-val">{isLeftSeat ? "LEFT SEAT" : "RIGHT SEAT"}</div>
                                                    <span className="metric-box-sub">{isLeftSeat ? "Position 1" : "Position 2"}</span>
                                                </div>
                                            </div>

                                            <div className="hall-metric-box highlight-student">
                                                <div className="metric-box-icon"><FaUserGraduate /></div>
                                                <div className="metric-box-content">
                                                    <span className="metric-box-label">STUDENT CREDENTIALS</span>
                                                    <div className="metric-box-val">{rollNo}</div>
                                                    <span className="metric-box-sub">{currentExam.branch || branch} (Batch {currentExam.batch || "A"})</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Exam Day Instructions Note */}
                                        <div className="exam-guidelines-strip">
                                            <div className="guideline-item">
                                                <strong>Notice:</strong> Please arrive at the hall at least 15 minutes before exam commencement. Keep your College ID Card placed visibly on your allocated desk.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()
                    ) : (
                        <div className="empty-hall-state">
                            <div className="empty-icon-box">
                                <FaBuilding />
                            </div>
                            <h3>No Seating Allocation Found</h3>
                            <p>Your examination hall and bench arrangement will appear here once the seating allocation is generated by administration.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default ExamHall;