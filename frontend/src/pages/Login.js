import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaGraduationCap } from "react-icons/fa";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const [role, setRole] = useState("Admin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const roleOptions = [
    { value: "Admin", label: "Admin" },
    { value: "Teacher", label: "Teacher" },
    { value: "Student", label: "Student" }
  ];

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          role: role.trim()
        })
      });

      const data = await res.json();
      const issuedToken = data.token || data.accessToken;

      if (res.ok && (data.success || issuedToken)) {
        if (issuedToken) {
          localStorage.setItem("token", issuedToken);
          localStorage.setItem("role", data.role || role.trim());
          localStorage.setItem("username", username.trim());
        }

        const userRole = String(data.role || role).toLowerCase();

        if (userRole === "admin") navigate("/ExamStatusBoard");
        else if (userRole === "teacher") navigate("/MyDutySchedule");
        else if (userRole === "student") navigate("/ExamHall");
      } else {
        setErrorMessage(data.message || "Invalid Login Credentials");
      }
    } catch (error) {
      console.error("Login Error:", error);
      setErrorMessage("Server is not responding. Ensure the backend is running on port 5000.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-container">
        {/* Title Outside the Card */}
        <div className="login-outside-header">
          <div className="brand-badge-outer">
            <FaGraduationCap className="brand-badge-icon" />
            <span>EXAMINATION PORTAL</span>
          </div>
          <h1 className="login-main-title">Exam Seating &amp; Duty Allocation</h1>
          <p className="login-main-subtitle">Automated Hall Management &amp; Invigilation System</p>
        </div>

        {/* Login Card */}
        <div className="login-card">
          <div className="login-card-header">
            <h2>Account Login</h2>
            <p>Select your role and enter credentials</p>
          </div>

        {errorMessage && (
          <div className="login-error-alert" role="alert">
            {errorMessage}
          </div>
        )}

        <form className="login-form" onSubmit={handleLogin}>
          <div className="form-group">
            <label>Select Role</label>
            <div className="role-selector-pills">
              {roleOptions.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  className={`role-pill ${role === opt.value ? "active" : ""}`}
                  onClick={() => {
                    setRole(opt.value);
                    setErrorMessage("");
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Username / Email</label>
            <input
              type="text"
              className="form-control"
              placeholder={
                role === "Admin"
                  ? "admin@sjcetpalai.ac.in"
                  : role === "Teacher"
                  ? "teacher@sjcetpalai.ac.in"
                  : "student@sjcetpalai.ac.in"
              }
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>

          <div className="signup-link">
            <p>
              Don't have an account?{" "}
              <span onClick={() => navigate("/signup")} className="create-account">
                Create one
              </span>
            </p>
          </div>
        </form>
      </div>
    </div>
  </div>
  );
}

export default Login;
