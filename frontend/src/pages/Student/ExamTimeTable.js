import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import StudentSidebar from './StudentSidebar';
import './ExamTimeTable.css'; 

const ExamTimeTable = () => {
    const navigate = useNavigate();
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);

    const checkAuth = useCallback(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/');
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
                const res = await axios.get('http://localhost:5000/api/student/exams', config);
                setExams(res.data);
                setLoading(false);
            } catch (err) {
                if (err.response && (err.response.status === 401 || err.response.status === 403)) {
                    localStorage.removeItem('token');
                    navigate('/');
                }
            }
        };
        fetchData();
    }, [navigate, checkAuth]);

    if (loading) return <div className="loading-screen">Loading Schedule...</div>;

    return (
        <div className="studashboard-container">
            <StudentSidebar />
            <main className="main-content">
                <header className="top-bar">
                    {/* Changed header to "MY EXAM TIMETABLE" */}
                    <h2>MY EXAM TIMETABLE</h2>
                </header>

                <div className="content-card">
                    <table className="timetable-table">
                        <thead>
                            <tr>
                                <th>DATE</th>
                                <th>SESSION</th>
                                <th>COURSE (CODE & NAME)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {exams.length > 0 ? (
                                exams.map((exam, index) => (
                                    <tr key={index}>
                                        <td className="date-cell">
                                            {new Date(exam.exam_date).toLocaleDateString('en-GB').replace(/\//g, '.')}
                                        </td>
                                        <td className="session-cell">{exam.session}</td>
                                        <td className="course-cell">
                                            <strong>{exam.sub_code}</strong> {exam.subject}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="3" className="empty-msg">
                                        No exam schedule found for this session.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                
                {/* Footer section was removed here */}
            </main>
        </div>
    );
};

export default ExamTimeTable;