import React, { useState, useEffect } from "react";
import axios from "axios";
import AdminSidebar from "./AdminSidebar";
import { FaEdit, FaTrash, FaPlus, FaMinus } from "react-icons/fa";
import "./ManageStudents.css";

const ManageStudents = () => {
  const [year, setYear] = useState(2026);
  const [branch, setBranch] = useState("CS");
  const [batchStrength, setBatchStrength] = useState(""); 
  const [studentList, setStudentList] = useState([]);
  const [isEditing, setIsEditing] = useState(false);

  const branchOrder = ["CS", "CE", "EC", "EE", "ME", "AI"];

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/students");
      setStudentList(res.data);
    } catch (err) {
      console.error("Fetch failed", err);
    }
  };

  const handleSubmit = async () => {
    if (!batchStrength) return alert("Please enter the Batch Strength");
    
    // PAYLOAD: Using 'strength' to match the updated server.js
    const payload = { 
        year, 
        branch, 
        strength: batchStrength 
    };

    try {
      if (isEditing) {
        await axios.put("http://localhost:5000/api/students/update", payload);
        alert("Updated successfully");
        resetForm();
      } else {
        await axios.post("http://localhost:5000/api/students/add", payload);
        
        // Auto-change branch logic
        const currentIndex = branchOrder.indexOf(branch);
        setBranch(branchOrder[(currentIndex + 1) % branchOrder.length]);
        
        setBatchStrength("");
        fetchStudents();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Operation failed");
    }
  };

  const handleEdit = (s) => {
    setIsEditing(true);
    setYear(s.year_of_join);
    setBranch(s.branch);
    // MAPPING: Pulling Branch_Strength from the database results
    setBatchStrength(s.Branch_Strength); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (y, b) => {
    if (window.confirm(`Delete ${b} ${y} record?`)) {
      try {
        await axios.delete(`http://localhost:5000/api/students/${y}/${b}`);
        fetchStudents();
      } catch (err) {
        alert("Delete failed");
      }
    }
  };

  const resetForm = () => {
    setBatchStrength("");
    setIsEditing(false);
    fetchStudents();
  };

  return (
    <div className="dashboard-container">
      <AdminSidebar />
      
      <main className="main-content">
        <div className="manage-card">
          <h2 className="card-title">
            {isEditing ? "Edit Student Record" : "Manage Students"}
          </h2>
          
          <div className="form-section">
            <div className="input-grid">
              <div className="input-box">
                <label>Year of Joining</label>
                <div className="year-stepper">
                  <button className="step-btn" onClick={() => setYear(year - 1)} disabled={isEditing}><FaMinus /></button>
                  <input type="number" value={year} readOnly className="year-input" />
                  <button className="step-btn" onClick={() => setYear(year + 1)} disabled={isEditing}><FaPlus /></button>
                </div>
              </div>
              
              <div className="input-box">
                <label>Branch</label>
                <select value={branch} onChange={(e) => setBranch(e.target.value)} disabled={isEditing} className="main-input">
                  {branchOrder.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              
              <div className="input-box">
                <label>Batch Strength</label>
                <input 
                  type="number" 
                  value={batchStrength} 
                  onChange={(e) => setBatchStrength(e.target.value)} 
                  placeholder="e.g. 60"
                  className="main-input"
                />
              </div>

              <div className="input-box button-group">
                <button className="submit-batch-btn" onClick={handleSubmit}>
                  {isEditing ? "Save Changes" : "Add Batch"}
                </button>
                {isEditing && (
                  <button className="cancel-btn" onClick={resetForm}>Cancel</button>
                )}
              </div>
            </div>
          </div>

          <div className="table-section">
            <table className="student-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Branch</th>
                  <th>Strength</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {studentList.map((s, i) => (
                  <tr key={i}>
                    <td>{s.year_of_join}</td>
                    <td>{s.branch}</td>
                    {/* DISPLAY: Accessing the DB column name */}
                    <td>{s.Branch_Strength}</td>
                    <td className="action-cell">
                      <FaEdit className="edit-btn" onClick={() => handleEdit(s)} title="Edit" />
                      <FaTrash className="delete-btn" onClick={() => handleDelete(s.year_of_join, s.branch)} title="Delete" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ManageStudents;