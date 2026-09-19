import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AdminSidebar from "./AdminSidebar";
import { 
  FaEdit, FaTrash, FaBolt, FaCopy, FaCalendarAlt, 
   FaBook, FaCheck, FaSearch 
} from "react-icons/fa";
import './ExamSchedule.css';

const DEFAULT_SUBJECTS_BY_YEAR = {
  1: {
    CSE: { name: "Engineering Mathematics I", code: "MA101" },
    ECE: { name: "Engineering Mathematics I", code: "MA101" },
    EEE: { name: "Engineering Mathematics I", code: "MA101" },
    IT:  { name: "Engineering Mathematics I", code: "MA101" },
    ME:  { name: "Engineering Mathematics I", code: "MA101" },
    CE:  { name: "Engineering Mathematics I", code: "MA101" },
    AI:  { name: "Engineering Mathematics I", code: "MA101" }
  },
  2: {
    CSE: { name: "Data Structures & Algorithms", code: "CS201" },
    ECE: { name: "Signals & Linear Systems", code: "EC201" },
    EEE: { name: "Electrical Machines & Drives", code: "EE201" },
    IT:  { name: "Object Oriented Programming", code: "IT201" },
    ME:  { name: "Fluid Mechanics & Machinery", code: "ME201" },
    CE:  { name: "Structural Analysis I", code: "CE201" },
    AI:  { name: "Foundations of Artificial Intelligence", code: "AI201" }
  },
  3: {
    CSE: { name: "Operating Systems Design", code: "CS301" },
    ECE: { name: "Microprocessors & Embedded Systems", code: "EC301" },
    EEE: { name: "Power Electronics & Control", code: "EE301" },
    IT:  { name: "Computer Networks & Security", code: "IT301" },
    ME:  { name: "Heat & Mass Transfer", code: "ME301" },
    CE:  { name: "Design of Concrete Structures", code: "CE301" },
    AI:  { name: "Deep Neural Networks", code: "AI301" }
  },
  4: {
    CSE: { name: "Distributed Computing & Cloud", code: "CS401" },
    ECE: { name: "Wireless & Mobile Communication", code: "EC401" },
    EEE: { name: "Smart Grid & Renewable Energy", code: "EE401" },
    IT:  { name: "Big Data & Predictive Analytics", code: "IT401" },
    ME:  { name: "Robotics & Automation Systems", code: "ME401" },
    CE:  { name: "Transportation & Urban Planning", code: "CE401" },
    AI:  { name: "Natural Language Processing", code: "AI401" }
  }
};

const ExamSchedule = () => {
    const branchList = ["CSE", "ECE", "EEE", "IT", "ME", "CE", "AI"];

    const [year, setYear] = useState(1);
    const [examNumber, setExamNumber] = useState('1');
    const [date, setDate] = useState('');
    const [session, setSession] = useState('FN');
    const [searchTerm, setSearchTerm] = useState('');
    
    const [subjects, setSubjects] = useState(
        branchList.reduce((acc, b) => ({ ...acc, [b]: { name: '', code: '' } }), {})
    );
    const [savedSchedules, setSavedSchedules] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [autoFillSuccess, setAutoFillSuccess] = useState(false);

    useEffect(() => { fetchSchedules(); }, []);

    const fetchSchedules = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/exam-schedule');
            setSavedSchedules(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("Fetch failed", err?.response?.data || err);
            setSavedSchedules([]);
        }
    };

    // Smart Automation 1: Auto-Fill Standard Courses for selected Academic Year
    const handleAutoFillStandard = () => {
        const standard = DEFAULT_SUBJECTS_BY_YEAR[year] || {};
        const newSubjects = { ...subjects };
        branchList.forEach(b => {
            if (standard[b]) {
                newSubjects[b] = { ...standard[b] };
            }
        });
        setSubjects(newSubjects);
        setAutoFillSuccess(true);
        setTimeout(() => setAutoFillSuccess(false), 2000);
    };

    // Smart Automation 2: Copy CSE Subject & Code to All Branches
    const handleCopyCseToAll = () => {
        const cseData = subjects["CSE"] || { name: '', code: '' };
        if (!cseData.name && !cseData.code) {
            alert("Please fill in the CSE course first to copy it to other branches.");
            return;
        }
        const newSubjects = { ...subjects };
        branchList.forEach(b => {
            newSubjects[b] = { name: cseData.name, code: cseData.code };
        });
        setSubjects(newSubjects);
    };

    const handleSave = async () => {
        if (!date) return alert("Please select an exam date!");
        const hasData = Object.values(subjects).some(s => s.name.trim() !== "");
        if (!hasData) return alert("Enter at least one course name!");

        try {
            const payload = { year, date, session, subjects, examNumber };
            if (editingId) {
                await axios.put(`http://localhost:5000/api/exam-schedule/update/${editingId}`, payload);
            } else {
                await axios.post('http://localhost:5000/api/exam-schedule/add', payload);
            }
            alert("Schedule Saved Successfully!");
            resetForm();
            fetchSchedules();
        } catch (err) {
            console.error("Save schedule error:", err);
            alert(err.response?.data?.message || "Error saving data.");
        }
    };

    const handleEdit = (item) => {
        setEditingId(item.exam_id);
        setYear(item.year);
        setExamNumber(item.exam_number || '1');
        setDate(item.exam_date?.split("T")[0] || '');
        setSession(item.session);

        const newSubjects = branchList.reduce((acc, b) => ({ ...acc, [b]: { name: '', code: '' } }), {});
        newSubjects[item.branch] = { name: item.subject, code: item.sub_code };
        setSubjects(newSubjects);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id) => {
        if (window.confirm("Delete this scheduled exam entry?")) {
            await axios.delete(`http://localhost:5000/api/exam-schedule/${id}`);
            fetchSchedules();
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setDate('');
        setExamNumber('1');
        setSubjects(branchList.reduce((acc, b) => ({ ...acc, [b]: { name: '', code: '' } }), {}));
    };

    const filteredSchedules = savedSchedules.filter(s => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (
            String(s.branch).toLowerCase().includes(q) ||
            String(s.subject).toLowerCase().includes(q) ||
            String(s.sub_code).toLowerCase().includes(q) ||
            String(s.session).toLowerCase().includes(q)
        );
    });

    return (
        <div className="admin-page-container">
            <AdminSidebar />
            <main className="admin-main-viewport">
                {/* Header */}
                <header className="admin-header-glass">
                    <div className="admin-header-left">
                        <div className="admin-context-pill">
                            <FaCalendarAlt /> CURRICULUM TIMETABLE
                        </div>
                        <h1>Exam Schedule Manager</h1>
                        <p className="admin-header-sub">
                            Configure examination dates, sessions, and multi-branch course codes with 1-click presets.
                        </p>
                    </div>

                    <div className="schedule-header-actions">
                        <button 
                            type="button" 
                            className={`smart-preset-btn ${autoFillSuccess ? 'success' : ''}`}
                            onClick={handleAutoFillStandard}
                            title="Automatically populate standard department subjects and course codes for this year"
                        >
                            {autoFillSuccess ? <FaCheck /> : <FaBolt />}
                            <span>{autoFillSuccess ? "Applied Year " + year + " Presets!" : "⚡ Auto-Fill Year " + year + " Courses"}</span>
                        </button>

                        <button 
                            type="button" 
                            className="smart-copy-btn"
                            onClick={handleCopyCseToAll}
                            title="Copy CSE subject and code across all departments"
                        >
                            <FaCopy />
                            <span>Copy CSE to All</span>
                        </button>
                    </div>
                </header>

                {/* Schedule Configuration Form (Compact & Efficient) */}
                <section className="admin-glass-panel schedule-form-panel">
                        <div className="admin-panel-head">
                            <div className="panel-title-group">
                                <h2>{editingId ? "Edit Examination Schedule" : "Schedule New Examination"}</h2>
                                <p>Select academic year, exam series & session, date, and input courses</p>
                            </div>
                        </div>

                        <div className="schedule-config-grid compact-config">
                            <div className="config-box">
                                <label>Academic Year</label>
                                <div className="year-pill-selector">
                                    {[1, 2, 3, 4].map(y => (
                                        <button 
                                            key={y} 
                                            type="button"
                                            className={`year-pill ${year === y ? 'active' : ''}`} 
                                            onClick={() => setYear(y)}
                                        >
                                            Year {y}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="config-box">
                                <label>Exam Series & Session (4 Total)</label>
                                <select 
                                    className="admin-glass-select" 
                                    value={examNumber} 
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setExamNumber(val);
                                        // Auto-sync session: Exam 1 & 2 -> FN; Exam 3 & 4 -> AN
                                        if (val === "1" || val === "2") setSession("FN");
                                        else if (val === "3" || val === "4") setSession("AN");
                                    }}
                                >
                                    <option value="1">Exam 1 (FN Session 1)</option>
                                    <option value="2">Exam 2 (FN Session 2)</option>
                                    <option value="3">Exam 3 (AN Session 1)</option>
                                    <option value="4">Exam 4 (AN Session 2)</option>
                                </select>
                            </div>

                            <div className="config-box">
                                <label>Exam Date</label>
                                <input 
                                    type="date" 
                                    className="admin-glass-input" 
                                    value={date} 
                                    onChange={(e) => setDate(e.target.value)} 
                                />
                            </div>

                            <div className="config-box">
                                <label>Session</label>
                                <div className="session-toggle-box">
                                    <button
                                        type="button"
                                        className={`sess-btn ${session === 'FN' ? 'active' : ''}`}
                                        onClick={() => setSession('FN')}
                                    >
                                        FN (Forenoon)
                                    </button>
                                    <button
                                        type="button"
                                        className={`sess-btn ${session === 'AN' ? 'active' : ''}`}
                                        onClick={() => setSession('AN')}
                                    >
                                        AN (Afternoon)
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Department Courses Matrix */}
                        <div className="branches-courses-container">
                            <div className="branch-grid-title">
                                <FaBook className="icon-book" />
                                <span>Department Courses Configuration</span>
                            </div>

                            <div className="branches-inputs-grid compact-grid">
                                {branchList.map(branch => (
                                    <div key={branch} className="branch-course-entry-card">
                                        <div className="branch-card-top-row">
                                            <div className="branch-chip-tag">{branch}</div>
                                            <span className="branch-title-hint">{branch} Department</span>
                                        </div>
                                        <div className="branch-fields-row">
                                            <div className="course-input-group code-group">
                                                <label className="field-micro-label">Course Code</label>
                                                <input
                                                    type="text"
                                                    className="branch-code-field"
                                                    placeholder="e.g. CS301"
                                                    value={subjects[branch].code}
                                                    onChange={(e) => setSubjects({
                                                        ...subjects,
                                                        [branch]: { ...subjects[branch], code: e.target.value }
                                                    })}
                                                />
                                            </div>
                                            <div className="course-input-group name-group">
                                                <label className="field-micro-label">Course Title</label>
                                                <input
                                                    type="text"
                                                    className="branch-name-field"
                                                    placeholder="Subject Name"
                                                    value={subjects[branch].name}
                                                    onChange={(e) => setSubjects({
                                                        ...subjects,
                                                        [branch]: { ...subjects[branch], name: e.target.value }
                                                    })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="schedule-form-actions">
                            {editingId && (
                                <button type="button" className="action-btn cancel" onClick={resetForm}>
                                    Cancel Edit
                                </button>
                            )}
                            <button type="button" className="action-btn primary full-w" onClick={handleSave}>
                                {editingId ? "Update Examination Schedule" : "Save Examination Schedule"}
                            </button>
                        </div>
                    </section>

                    {/* Right Saved Schedules Matrix Panel (Visible without scrolling) */}
                    <section className="admin-glass-panel schedule-table-panel">
                        <div className="admin-panel-head">
                            <div className="panel-title-group">
                                <h2>Scheduled Courses Roster</h2>
                                <p>{savedSchedules.length} examination course schedules in database</p>
                            </div>

                            <div className="roster-search-box">
                                <FaSearch className="search-icon" />
                                <input
                                    type="text"
                                    placeholder="Filter by subject, branch, code..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="admin-table-scroll schedule-table-scroll">
                            <table className="admin-modern-table schedule-table">
                                <thead>
                                    <tr>
                                        <th className="th-center">Year</th>
                                        <th className="th-center">Series</th>
                                        <th className="th-center">Date</th>
                                        <th className="th-center">Session</th>
                                        <th className="th-center">Branch</th>
                                        <th className="th-center">Code</th>
                                        <th className="th-center">Course Title</th>
                                        <th className="th-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSchedules.length > 0 ? (
                                        filteredSchedules.map((s) => (
                                            <tr key={s.exam_id}>
                                                <td className="td-center">
                                                    <span className="year-badge">Year {s.year}</span>
                                                </td>
                                                <td className="td-center">Exam {s.exam_number || 1}</td>
                                                <td className="td-center">
                                                    <div className="t-phone-cell" style={{ justifyContent: 'center' }}>
                                                        <FaCalendarAlt className="col-icon blue" />
                                                        <strong>{new Date(s.exam_date).toLocaleDateString('en-GB')}</strong>
                                                    </div>
                                                </td>
                                                <td className="td-center">
                                                    <span className={`admin-session-chip ${s.session}`}>
                                                        {s.session}
                                                    </span>
                                                </td>
                                                <td className="td-center">
                                                    <strong className="branch-tag">{s.branch}</strong>
                                                </td>
                                                <td className="td-center">
                                                    <span className="code-pill-tag">{s.sub_code}</span>
                                                </td>
                                                <td className="td-center">
                                                    <span className="subject-title-text">{s.subject}</span>
                                                </td>
                                                <td className="td-center">
                                                    <div className="table-actions-group" style={{ justifyContent: 'center' }}>
                                                        <button 
                                                            type="button" 
                                                            className="edit-icon-btn" 
                                                            onClick={() => handleEdit(s)}
                                                            title="Edit this entry"
                                                        >
                                                            <FaEdit />
                                                        </button>
                                                        <button 
                                                            type="button" 
                                                            className="delete-icon-btn" 
                                                            onClick={() => handleDelete(s.exam_id)}
                                                            title="Delete this entry"
                                                        >
                                                            <FaTrash />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="8" className="admin-empty-cell">
                                                <p>No matching schedules found.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
            </main>
        </div>
    );
};

export default ExamSchedule;
