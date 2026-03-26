import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AdminSidebar from "./AdminSidebar";
import { FaEdit, FaTrash } from "react-icons/fa";
import './ExamSchedule.css';

const ExamSchedule = () => {
    const branchList = ["CS", "AD", "CY", "ME", "EE", "EC", "ES", "CE"];

    const [year, setYear] = useState(1);
    const [examNumber, setExamNumber] = useState('1');
    const [date, setDate] = useState('');
    const [session, setSession] = useState('FN');
    
    // Updated state to hold both Name and Code
    const [subjects, setSubjects] = useState(
        branchList.reduce((acc, b) => ({ ...acc, [b]: { name: '', code: '' } }), {})
    );
    const [savedSchedules, setSavedSchedules] = useState([]);
    const [editingId, setEditingId] = useState(null);

    useEffect(() => { fetchSchedules(); }, []);

    const fetchSchedules = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/exam-schedule');
            setSavedSchedules(res.data || []);
        } catch (err) { console.error("Fetch failed", err); }
    };

    const handleSave = async () => {
        if (!date) return alert("Please select a date!");
        const hasData = Object.values(subjects).some(s => s.name.trim() !== "");
        if (!hasData) return alert("Enter at least one subject name!");

        try {
            const payload = { year, date, session, subjects, examNumber };
            if (editingId) {
                await axios.post(`http://localhost:5000/api/exam-schedule/update/${editingId}`, payload);
            } else {
                await axios.post('http://localhost:5000/api/exam-schedule/add', payload);
            }
            alert("Schedule Saved Successfully!");
            resetForm();
            fetchSchedules();
        } catch (err) { alert("Error saving data."); }
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
        if (window.confirm("Delete this entry?")) {
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

    return (
        <div className="dashboard-container">
            <AdminSidebar />
            <main className="main-content">
                <div className="manage-card">
                    <h2 className="card-title">Exam Schedule Management</h2>

                    <div className="form-section">
                        <div className="top-controls">
                            <div className="input-box">
                                <label>Year</label>
                                <div className="year-stepper">
                                    {[1, 2, 3, 4].map(y => (
                                        <button key={y} className={`step-btn ${year === y ? 'active' : ''}`} onClick={() => setYear(y)}>{y}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="input-box">
                                <label>Exam Number</label>
                                <select className="main-input" value={examNumber} onChange={(e) => setExamNumber(e.target.value)}>
                                    <option value="1">Exam 1</option><option value="2">Exam 2</option><option value="3">Exam 3</option>
                                </select>
                            </div>
                            <div className="input-box"><label>Date</label><input type="date" className="main-input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
                            <div className="input-box"><label>Session</label><select className="main-input" value={session} onChange={(e) => setSession(e.target.value)}><option value="FN">FN</option><option value="AN">AN</option></select></div>
                        </div>

                        <div className="subjects-grid">
                            {branchList.map(branch => (
                                <div key={branch} className="subject-input-group">
                                    <span className="branch-label">{branch}:</span>
                                    {/* Subject Code Input */}
                                    <input
                                        type="text"
                                        className="code-input"
                                        placeholder="Code"
                                        value={subjects[branch].code}
                                        onChange={(e) => setSubjects({ ...subjects, [branch]: { ...subjects[branch], code: e.target.value } })}
                                    />
                                    {/* Subject Name Input */}
                                    <input
                                        type="text"
                                        className="subject-input"
                                        placeholder="Subject Name"
                                        value={subjects[branch].name}
                                        onChange={(e) => setSubjects({ ...subjects, [branch]: { ...subjects[branch], name: e.target.value } })}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="button-group">
                            <button className="save-btn" onClick={handleSave}>{editingId ? "Update Schedule" : "Save Schedule"}</button>
                            {editingId && <button className="cancel-btn" onClick={resetForm}>Cancel</button>}
                        </div>
                    </div>

                    <div className="table-section">
                        <table className="schedule-table">
                            <thead>
                                <tr>
                                    <th>Year</th><th>Exam No.</th><th>Date</th><th>Session</th><th>Branch</th><th>Code</th><th>Subject</th><th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {savedSchedules.map((s) => (
                                    <tr key={s.exam_id}>
                                        <td>{s.year}</td><td>{s.exam_number}</td>
                                        <td>{new Date(s.exam_date).toLocaleDateString('en-GB')}</td>
                                        <td><span className={`badge ${s.session}`}>{s.session}</span></td>
                                        <td className="branch-col">{s.branch}</td>
                                        <td><strong>{s.sub_code}</strong></td>
                                        <td>{s.subject}</td>
                                        <td className="action-cell">
                                            <FaEdit className="icon-edit" onClick={() => handleEdit(s)} />
                                            <FaTrash className="icon-delete" onClick={() => handleDelete(s.exam_id)} />
                                        </td>
                                    </tr>
                                ))}
                                {savedSchedules.length === 0 && <tr><td colSpan="8" className="no-data">No schedules found</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ExamSchedule;