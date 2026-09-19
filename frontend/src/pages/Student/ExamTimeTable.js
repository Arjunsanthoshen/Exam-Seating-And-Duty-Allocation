import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../api/config';
import {
  FaCalendarAlt,
  FaClock,
  FaBookOpen,
  FaGraduationCap,
  FaCheckCircle,
  FaExclamationCircle
} from 'react-icons/fa';
import StudentSidebar from './StudentSidebar';
import './ExamTimeTable.css';

const ExamTimeTable = () => {
    const navigate = useNavigate();
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

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
                const res = await axios.get(`${API_BASE_URL}/api/student/exams`, config);
                setExams(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                if (err.response && (err.response.status === 401 || err.response.status === 403)) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('role');
                    localStorage.removeItem('username');
                    navigate('/login');
                    return;
                }
                setError('Failed to load examination timetable.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [navigate, checkAuth]);

    if (loading) {
        return (
            <div className="studashboard-container">
                <StudentSidebar />
                <main className="main-content">
                    <div className="timetable-loading-card">
                        <div className="timetable-loading-spinner"></div>
                        <p>Loading your exam timetable...</p>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="studashboard-container">
            <StudentSidebar />
            <main className="main-content">
                {/* Header */}
                <header className="timetable-top-bar">
                    <div className="timetable-header-left">
                        <div className="timetable-portal-pill">
                            <FaGraduationCap /> OFFICIAL EXAMINATION SCHEDULE
                        </div>
                        <h2>My Exam Timetable</h2>
                        <p className="timetable-subhead">
                            Designated examination dates, course papers, and slot timings.
                        </p>
                    </div>

                    {exams.length > 0 && (
                        <div className="timetable-count-pill">
                            <FaCheckCircle className="count-icon" />
                            <span>{exams.length} {exams.length === 1 ? 'Exam' : 'Exams'} Scheduled</span>
                        </div>
                    )}
                </header>

                {/* Glass Card */}
                <div className="timetable-content-card">
                    {error ? (
                        <div className="timetable-alert error">
                            <FaExclamationCircle />
                            <span>{error}</span>
                        </div>
                    ) : null}

                    {exams.length > 0 ? (
                        <div className="timetable-items-wrap">
                            <table className="timetable-modern-table">
                                <thead>
                                    <tr>
                                        <th>Date & Day</th>
                                        <th>Session Timing</th>
                                        <th>Course Code</th>
                                        <th>Course Title</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {exams.map((exam, index) => {
                                        const dateObj = new Date(exam.exam_date);
                                        const formattedDate = dateObj.toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        });
                                        const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

                                        return (
                                            <tr key={index}>
                                                <td className="tt-date-cell">
                                                    <div className="tt-date-box">
                                                        <FaCalendarAlt className="tt-cal-icon" />
                                                        <div className="tt-date-text">
                                                            <strong>{formattedDate}</strong>
                                                            <span className="tt-weekday">{weekday}</span>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td>
                                                    <span className={`tt-session-pill ${exam.session || 'FN'}`}>
                                                        <FaClock />
                                                        <span>
                                                            {exam.session === 'FN'
                                                                ? 'FN • 09:30 AM – 12:30 PM'
                                                                : 'AN • 01:30 PM – 04:30 PM'}
                                                        </span>
                                                    </span>
                                                </td>

                                                <td>
                                                    <span className="tt-code-pill">
                                                        <FaBookOpen />
                                                        <strong>{exam.sub_code || "CODE"}</strong>
                                                    </span>
                                                </td>

                                                <td className="tt-subject-cell">
                                                    <span className="tt-subject-name">{exam.subject}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : !error ? (
                        <div className="timetable-empty-state">
                            <div className="timetable-empty-icon">
                                <FaCalendarAlt />
                            </div>
                            <h3>No Scheduled Exams Found</h3>
                            <p>You currently do not have any exams scheduled for your enrolled courses.</p>
                        </div>
                    ) : null}
                </div>
            </main>
        </div>
    );
};

export default ExamTimeTable;
