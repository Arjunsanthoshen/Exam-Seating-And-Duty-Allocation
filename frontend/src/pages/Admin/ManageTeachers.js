import React, { useEffect, useState } from "react";
import AdminSidebar from "./AdminSidebar";
import "./ManageTeachers.css";

const ManageTeachers = () => {

  const [teachers, setTeachers] = useState([]);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    username: "",
    password: "",
    name: "",
    department: "",
    phone: "",
    availability: "Yes"
  });

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    const res = await fetch("http://localhost:5000/api/teachers");
    const data = await res.json();
    setTeachers(data);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAddTeacher = async (e) => {
    e.preventDefault();

    const res = await fetch("http://localhost:5000/api/teachers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });

    const data = await res.json();
    alert(data.message);

    fetchTeachers();

    setForm({
      username: "",
      password: "",
      name: "",
      department: "",
      phone: "",
      availability: "Yes"
    });
  };

  const handleDelete = async (username) => {
    if (!window.confirm("Delete this teacher?")) return;

    await fetch(`http://localhost:5000/api/teachers/${username}`, {
      method: "DELETE"
    });

    fetchTeachers();
  };

  const handleAvailabilityChange = async (username, availability) => {
    await fetch("http://localhost:5000/api/teachers/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, availability })
    });

    fetchTeachers();
  };

  const filteredTeachers = teachers.filter((teacher) =>
    teacher.name.toLowerCase().includes(search.toLowerCase()) ||
    teacher.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
  <div className="dashboard-container">
    <AdminSidebar />

    <main className="main-content">
      <div className="manage-container">

        <h2 className="page-title">Manage Teachers</h2>

        {/* Add Teacher Card */}
        <div className="card">
          <div className="card-header">Add Teacher</div>

          <form onSubmit={handleAddTeacher} className="add-form">
            <input type="text" name="name" placeholder="Teacher Name" value={form.name} onChange={handleChange} required />
            <input type="text" name="username" placeholder="Username" value={form.username} onChange={handleChange} required />
            <input type="password" name="password" placeholder="Password" value={form.password} onChange={handleChange} required />
            <input type="text" name="department" placeholder="Department" value={form.department} onChange={handleChange} required />
            <input type="text" name="phone" placeholder="Phone" value={form.phone} onChange={handleChange} required />

            <button type="submit" className="btn-primary">Add Teacher</button>
          </form>
        </div>

        {/* Search */}
        <input
          className="search-box"
          type="text"
          placeholder="Search by name"
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Teacher Table */}
        <div className="table-card">
          <div className="table-header">Teacher Table</div>

          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Department</th>
                <th>Phone</th>
                <th>Availability</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredTeachers.map((teacher) => (
                <tr key={teacher.username}>
                  <td>{teacher.name}</td>
                  <td>{teacher.department}</td>
                  <td>{teacher.phone}</td>
                  <td>
                    <select
                      value={teacher.availability}
                      onChange={(e) =>
                        handleAvailabilityChange(teacher.username, e.target.value)
                      }
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </td>
                  <td>
                    <button
                      className="btn-delete"
                      onClick={() => handleDelete(teacher.username)}
                    >
                      Delete
                    </button>
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

export default ManageTeachers;
