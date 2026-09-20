import React, { useState, useEffect } from "react";
import axios from "axios";
import AdminSidebar from "./AdminSidebar";
import { API_BASE_URL } from "../../api/config";
import { 
  FaUserGraduate, FaPlus, FaMinus, FaEdit, FaTrash, 
  FaSearch, FaBolt, FaUsers
} from "react-icons/fa";
import "./ManageStudents.css";

const ManageStudents = () => {
  const [year, setYear] = useState(2025);
  const [branch, setBranch] = useState("CSE");
  const [batch, setBatch] = useState("A");
  const [batchStrength, setBatchStrength] = useState("50");
  const [studentList, setStudentList] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedYearFilter, setSelectedYearFilter] = useState("All");
  const [searchBranch, setSearchBranch] = useState("");

  const branchOrder = ["CSE", "ECE", "EEE", "IT", "ME", "CE", "AI"];
  const batchOptions = ["A", "B", "C"];

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/students`);
      if (Array.isArray(res.data)) {
        setStudentList(res.data);
      }
    } catch (err) {
      console.error("Fetch failed", err);
    }
  };

  const handleSubmit = async () => {
    if (!batchStrength) return alert("Please enter the Batch Strength");

    const payload = { year, branch, batch, strength: batchStrength };

    try {
      if (isEditing) {
        await axios.put(`${API_BASE_URL}/api/students/update`, payload);
        alert("Batch updated successfully!");
        resetForm();
      } else {
        await axios.post(`${API_BASE_URL}/api/students/add`, payload);
        alert("Batch added successfully!");

        const currentIndex = branchOrder.indexOf(branch);
        setBranch(branchOrder[(currentIndex + 1) % branchOrder.length]);
        setBatch("A");
        setBatchStrength("50");
        fetchStudents();
      }
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Operation failed. Check if Year + Branch + Batch already exists."
      );
    }
  };

  const handleEdit = (s) => {
    setIsEditing(true);
    setYear(s.year_of_join);
    setBranch(s.branch);
    setBatch(s.batch || "A");
    setBatchStrength(s.end_serial || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const isDemoUser = localStorage.getItem("isDemo") === "true" || (localStorage.getItem("username") || "").toLowerCase() === "demo";

  const handleDelete = async (y, b, bt) => {
    const student = studentList.find(s => s.year_of_join === y && s.branch === b && s.batch === bt);
    if (isDemoUser && (!student || !student.is_demo)) {
      alert("Demo users cannot delete this data.");
      return;
    }

    if (window.confirm(`Delete ${b} Batch ${bt} (Join Year ${y}) record?`)) {
      try {
        await axios.delete(`${API_BASE_URL}/api/students/${y}/${b}/${bt}`);
        fetchStudents();
      } catch (err) {
        alert(err.response?.data?.message || "Delete failed");
      }
    }
  };

  const resetForm = () => {
    setBatchStrength("50");
    setBatch("A");
    setIsEditing(false);
    fetchStudents();
  };

  const totalEnrolled = studentList.reduce((acc, s) => acc + (parseInt(s.end_serial) || 0), 0);
  const distinctYears = [...new Set(studentList.map(s => s.year_of_join))].sort((a, b) => b - a);

  const filteredStudents = studentList.filter(s => {
    const matchesYear = selectedYearFilter === "All" || String(s.year_of_join) === String(selectedYearFilter);
    const matchesBranch = !searchBranch || s.branch.toLowerCase().includes(searchBranch.toLowerCase());
    return matchesYear && matchesBranch;
  });

  return (
    <div className="admin-page-container">
      <AdminSidebar />

      <main className="admin-main-viewport">
        {/* Header */}
        <header className="admin-header-glass">
          <div className="admin-header-left">
            <div className="admin-context-pill">
              <FaUserGraduate /> STUDENT ENROLMENT & BATCHES
            </div>
            <h1>Student Batches & Classes</h1>
            <p className="admin-header-sub">
              Manage academic batches, intake strengths, and student roll number sequences across departments.
            </p>
          </div>

          <div className="teacher-header-stats">
            <div className="stat-pill-item available">
              <span className="stat-num">{totalEnrolled}</span>
              <span className="stat-label">Total Enrolled</span>
            </div>
            <div className="stat-pill-item">
              <span className="stat-num">{studentList.length}</span>
              <span className="stat-label">Active Batches</span>
            </div>
            <div className="stat-pill-item">
              <span className="stat-num">{distinctYears.length}</span>
              <span className="stat-label">Academic Years</span>
            </div>
          </div>
        </header>

        {/* Form Panel */}
        <section className="admin-glass-panel">
          <div className="admin-panel-head">
            <div className="panel-title-group">
              <h2>{isEditing ? "Modify Student Batch" : "Configure Student Batch"}</h2>
              <p>Define academic intake year, department branch, batch code, and student strength</p>
            </div>

            {/* Quick Automation Preset */}
            <button
              type="button"
              className="smart-copy-btn"
              onClick={() => setBatchStrength("50")}
              title="Set strength to standard 50 students"
            >
              <FaBolt /> Preset 50 Students
            </button>
          </div>

          <div className="schedule-config-grid">
            <div className="config-box">
              <label>Year of Joining</label>
              <div className="student-year-stepper">
                <button
                  type="button"
                  className="step-btn"
                  onClick={() => setYear(year - 1)}
                  disabled={isEditing}
                >
                  <FaMinus />
                </button>
                <span className="year-display">{year}</span>
                <button
                  type="button"
                  className="step-btn"
                  onClick={() => setYear(year + 1)}
                  disabled={isEditing}
                >
                  <FaPlus />
                </button>
              </div>
            </div>

            <div className="config-box">
              <label>Department / Branch</label>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                disabled={isEditing}
                className="admin-glass-select"
              >
                {branchOrder.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div className="config-box">
              <label>Section / Batch</label>
              <div className="year-pill-selector">
                {batchOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`year-pill ${batch === opt ? "active" : ""}`}
                    onClick={() => setBatch(opt)}
                    disabled={isEditing}
                  >
                    Batch {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="config-box">
              <label>Batch Strength</label>
              <input
                type="number"
                value={batchStrength}
                onChange={(e) => setBatchStrength(e.target.value)}
                placeholder="e.g. 50"
                className="admin-glass-input"
              />
            </div>
          </div>

          <div className="schedule-form-actions">
            {isEditing && (
              <button type="button" className="action-btn cancel" onClick={resetForm}>
                Cancel Edit
              </button>
            )}
            <button type="button" className="action-btn primary" onClick={handleSubmit}>
              {isEditing ? "Save Changes" : "Register Batch"}
            </button>
          </div>
        </section>

        {/* Batches Table Panel */}
        <section className="admin-glass-panel">
          <div className="admin-panel-head">
            <div className="panel-title-group">
              <h2>Registered Student Batches</h2>
              <p>{studentList.length} total department batches in system</p>
            </div>

            <div className="teacher-table-controls">
              {/* Year Filter Chips */}
              <div className="dept-pills-row">
                <button
                  type="button"
                  className={`dept-pill ${selectedYearFilter === "All" ? 'active' : ''}`}
                  onClick={() => setSelectedYearFilter("All")}
                >
                  All Years
                </button>
                {distinctYears.map(y => (
                  <button
                    key={y}
                    type="button"
                    className={`dept-pill ${selectedYearFilter === String(y) ? 'active' : ''}`}
                    onClick={() => setSelectedYearFilter(String(y))}
                  >
                    {y}
                  </button>
                ))}
              </div>

              {/* Branch Search */}
              <div className="roster-search-box">
                <FaSearch className="search-icon" />
                <input
                  type="text"
                  placeholder="Filter branch..."
                  value={searchBranch}
                  onChange={(e) => setSearchBranch(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="admin-table-scroll">
            <table className="admin-modern-table">
              <thead>
                <tr>
                  <th className="th-center">Enrolment Year</th>
                  <th className="th-center">Department Branch</th>
                  <th className="th-center">Batch Section</th>
                  <th className="th-center">Student Strength</th>
                  <th className="th-center">Status</th>
                  <th className="th-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((s, i) => (
                    <tr key={i}>
                      <td className="td-center">
                        <span className="year-badge">Batch of {s.year_of_join}</span>
                      </td>
                      <td className="td-center">
                        <strong className="branch-tag">{s.branch}</strong>
                      </td>
                      <td className="td-center">
                        <span className="code-pill-tag">Batch {s.batch}</span>
                      </td>
                      <td className="td-center">
                        <div className="capacity-pill-tag">
                          <FaUsers /> {s.end_serial} Students
                        </div>
                      </td>
                      <td className="td-center">
                        <span className="admin-ready-tag">Verified</span>
                      </td>
                      <td className="td-center">
                        <div className="table-actions-group" style={{ justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="edit-icon-btn"
                            onClick={() => handleEdit(s)}
                            title="Edit batch strength"
                          >
                            <FaEdit />
                          </button>
                          <button
                            type="button"
                            className="delete-icon-btn"
                            onClick={() => handleDelete(s.year_of_join, s.branch, s.batch)}
                            title="Remove batch"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="admin-empty-cell">
                      <p>No student cohorts found matching your filters.</p>
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

export default ManageStudents;