import React, { useEffect, useState } from "react";
import axios from "axios";
import AdminSidebar from "./AdminSidebar";
import { API_BASE_URL } from "../../api/config";
import { 
  FaUsers, FaUserPlus, FaFileExcel, FaDownload, 
  FaSearch, FaTrash, FaCheckCircle, FaTimesCircle,
  FaPhone
} from "react-icons/fa";

import "./ManageTeachers.css";

const DEPARTMENTS = ["All", "CSE", "ECE", "EEE", "IT", "ME", "CE"];

const ManageTeachers = () => {
  const [teachers, setTeachers] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("All");
  const [excelFile, setExcelFile] = useState(null);
  const [uploadingExcel, setUploadingExcel] = useState(false);

  const [form, setForm] = useState({
    username: "",
    password: "",
    name: "",
    department: "CSE",
    phone: "",
    availability: "Yes"
  });

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/teachers`);
      setTeachers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch teachers:", err);
      setTeachers([]);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    setExcelFile(e.target.files[0]);
  };

  const handleAddTeacher = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE_URL}/api/teachers`, form);
      alert(res.data?.message || "Faculty member added successfully");
      fetchTeachers();
      setForm({
        username: "",
        password: "",
        name: "",
        department: "CSE",
        phone: "",
        availability: "Yes"
      });
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add faculty member");
    }
  };

  const handleDelete = async (username) => {
    if (!window.confirm(`Delete faculty member ${username}?`)) return;
    try {
      const res = await axios.delete(`${API_BASE_URL}/api/teachers/${username}`);
      alert(res.data?.message || "Faculty member removed successfully");
      fetchTeachers();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete teacher");
    }
  };

  const handleExcelUpload = async () => {
    if (!excelFile) {
      alert("Please select an Excel file to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("file", excelFile);
    setUploadingExcel(true);

    try {
      const res = await axios.post(`${API_BASE_URL}/api/teachers/upload-excel`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      alert(res.data?.message || "Excel batch uploaded successfully!");
      setExcelFile(null);
      fetchTeachers();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to upload Excel file");
    } finally {
      setUploadingExcel(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/teachers/template`, {
        responseType: "blob"
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = "teacher_template.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to download template");
    }
  };

  const handleToggleAvailability = async (teacher) => {
    const nextAvailability = teacher.availability === "Yes" ? "No" : "Yes";
    try {
      await axios.put(`${API_BASE_URL}/api/teachers/availability`, {
        username: teacher.username,
        availability: nextAvailability
      });
      fetchTeachers();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update availability");
    }
  };

  const teacherList = Array.isArray(teachers) ? teachers : [];
  const availableCount = teacherList.filter(t => t.availability === "Yes").length;
  const unavailableCount = teacherList.length - availableCount;

  const filteredTeachers = teacherList.filter((teacher) => {
    const matchesSearch = 
      (teacher?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (teacher?.username || "").toLowerCase().includes(search.toLowerCase()) ||
      (teacher?.department || "").toLowerCase().includes(search.toLowerCase());

    const matchesDept = selectedDept === "All" || (teacher?.department || "").toUpperCase() === selectedDept;

    return matchesSearch && matchesDept;
  });

  return (
    <div className="admin-page-container">
      <AdminSidebar />

      <main className="admin-main-viewport">
        {/* Header */}
        <header className="admin-header-glass">
          <div className="admin-header-left">
            <div className="admin-context-pill">
              <FaUsers /> FACULTY ROSTER & INVIGILATORS
            </div>
            <h1>Faculty Management</h1>
            <p className="admin-header-sub">
              Manage faculty credentials, departments, availability status, and bulk Excel imports.
            </p>
          </div>

          <div className="teacher-header-stats">
            <div className="stat-pill-item">
              <span className="stat-num">{teacherList.length}</span>
              <span className="stat-label">Total Faculty</span>
            </div>
            <div className="stat-pill-item available">
              <span className="stat-num">{availableCount}</span>
              <span className="stat-label">Available</span>
            </div>
            <div className="stat-pill-item unavailable">
              <span className="stat-num">{unavailableCount}</span>
              <span className="stat-label">Exempt / On Leave</span>
            </div>
          </div>
        </header>

        {/* Top Split Grid: Excel (Left) and Manual Registration (Right) */}
        <div className="teacher-action-panels-grid">
          {/* Primary Hero Action: Excel Bulk Import */}
          <section className="admin-glass-panel excel-hero-panel">
            <div className="admin-panel-head">
              <div className="panel-title-group">
                <div className="hero-feature-badge">PRIMARY REGISTRATION METHOD</div>
                <h2><FaFileExcel className="panel-icon green" /> Batch Import Faculty (Excel)</h2>
                <p>Upload a standard Excel roster (.xlsx / .xls) to sync and register all department faculty at once</p>
              </div>

              <button
                type="button"
                className="admin-refresh-btn excel-template-btn"
                onClick={handleDownloadTemplate}
                title="Download standard Excel format"
              >
                <FaDownload /> Download Template
              </button>
            </div>

            <div className="excel-drop-container hero-dropzone">
              <input
                type="file"
                accept=".xlsx,.xls"
                id="excelUploadInput"
                onChange={handleFileChange}
                hidden
              />

              <label htmlFor="excelUploadInput" className="excel-drop-label hero-label">
                <div className="excel-icon-glow-ring">
                  <FaFileExcel className="excel-big-icon" />
                </div>
                <span className="excel-drop-title">
                  {excelFile ? excelFile.name : "Click or Drop Excel Spreadsheet Here"}
                </span>
                <span className="excel-drop-sub">
                  {excelFile ? "File selected • Ready to upload & sync" : "Supports .xlsx and .xls • Auto-creates faculty logins"}
                </span>
              </label>

              {excelFile && (
                <button
                  type="button"
                  className="admin-quick-btn primary full-w hero-upload-btn"
                  disabled={uploadingExcel}
                  onClick={handleExcelUpload}
                >
                  {uploadingExcel ? "Processing Spreadsheet..." : "Upload & Sync Faculty Roster Now"}
                </button>
              )}
            </div>
          </section>

          {/* Secondary Action: Manual Faculty Registration */}
          <section className="admin-glass-panel manual-register-panel">
            <div className="admin-panel-head">
              <div className="panel-title-group">
                <h2><FaUserPlus className="panel-icon" /> Register Individual Faculty</h2>
                <p>Add a single invigilator manually by filling in their credentials</p>
              </div>
            </div>

            <form onSubmit={handleAddTeacher} className="teacher-register-form">
              <div className="teacher-form-row">
                <div className="t-form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    name="name"
                    className="admin-glass-input"
                    placeholder="e.g. Dr. Jane Smith"
                    value={form.name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="t-form-group">
                  <label>Official Email</label>
                  <input
                    type="email"
                    name="username"
                    className="admin-glass-input"
                    placeholder="e.g. janesmith@sjcet.ac.in"
                    value={form.username}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="teacher-form-row">
                <div className="t-form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    name="password"
                    className="admin-glass-input"
                    placeholder="Temporary password"
                    value={form.password}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="t-form-group">
                  <label>Department</label>
                  <select
                    name="department"
                    className="admin-glass-select"
                    value={form.department}
                    onChange={handleChange}
                    required
                  >
                    {["CSE", "ECE", "EEE", "IT", "ME", "CE", "Basic Science"].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="teacher-form-row">
                <div className="t-form-group">
                  <label>Phone Number</label>
                  <input
                    type="text"
                    name="phone"
                    className="admin-glass-input"
                    placeholder="e.g. 9876543210"
                    value={form.phone}
                    onChange={handleChange}
                  />
                </div>

                <div className="t-form-group button-group-inline">
                  <label>&nbsp;</label>
                  <button type="submit" className="admin-quick-btn primary full-w">
                    <FaUserPlus /> Save Faculty Member
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>

        {/* Teachers Table Panel (Full Width Below) */}
        <section className="admin-glass-panel">
          <div className="admin-panel-head">
            <div className="panel-title-group">
              <h2>Registered Faculty Roster</h2>
              <p>Active teaching staff available for exam duty allocation</p>
            </div>

            <div className="teacher-table-controls">
              {/* Department Filter Pills */}
              <div className="dept-pills-row">
                {DEPARTMENTS.map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    className={`dept-pill ${selectedDept === dept ? 'active' : ''}`}
                    onClick={() => setSelectedDept(dept)}
                  >
                    {dept}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div className="roster-search-box">
                <FaSearch className="search-icon" />
                <input
                  type="text"
                  placeholder="Search faculty by name, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="admin-table-scroll">
            <table className="admin-modern-table teachers-table">
              <thead>
                <tr>
                  <th>Faculty Member</th>
                  <th className="th-center">Department</th>
                  <th className="th-center">Contact Phone</th>
                  <th className="th-center">Invigilation Availability</th>
                  <th className="th-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.length > 0 ? (
                  filteredTeachers.map((teacher) => {
                    const isAvailable = teacher.availability === "Yes";
                    const initial = (teacher.name || "T").charAt(0).toUpperCase();

                    return (
                      <tr key={teacher.username}>
                        <td className="teacher-member-col">
                          <div className="t-avatar-box">{initial}</div>
                          <div className="t-name-details">
                            <strong>{teacher.name}</strong>
                            <span className="t-user-email">{teacher.username}</span>
                          </div>
                        </td>

                        <td className="td-center">
                          <span className="dept-badge-tag">{teacher.department}</span>
                        </td>

                        <td className="td-center">
                          <div className="t-phone-cell">
                            <FaPhone className="cell-phone-icon" />
                            <span>{teacher.phone || "Not specified"}</span>
                          </div>
                        </td>

                        <td className="td-center">
                          <button
                            type="button"
                            className={`availability-toggle-btn ${isAvailable ? 'available' : 'exempt'}`}
                            onClick={() => handleToggleAvailability(teacher)}
                            title="Click to toggle availability"
                          >
                            {isAvailable ? <FaCheckCircle /> : <FaTimesCircle />}
                            <span>{isAvailable ? "Available" : "On Leave / Exempt"}</span>
                          </button>
                        </td>

                        <td className="td-center">
                          <button
                            type="button"
                            className="delete-icon-btn"
                            onClick={() => handleDelete(teacher.username)}
                            title="Remove faculty member"
                          >
                            <FaTrash />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="5" className="admin-empty-cell">
                      <p>No faculty members found matching your search.</p>
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

export default ManageTeachers;
