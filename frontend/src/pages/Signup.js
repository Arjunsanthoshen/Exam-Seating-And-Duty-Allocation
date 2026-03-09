import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css"; // reuse the same style as login

function Signup() {

  const navigate = useNavigate();

  const [role, setRole] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async (e) => {

    e.preventDefault();

    try {

      const res = await fetch("http://localhost:5000/api/signup", {

        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          username,
          password,
          role
        })

      });

      const data = await res.json();

      if (res.ok) {

        alert("Account created successfully!");

        navigate("/");

      } else {

        alert(data.message || "Signup failed");

      }

    } catch (error) {

      console.error(error);

      alert("Server error");

    }

  };

  return (

    <div className="login-wrapper">

      <div className="login-card">

        <div className="login-header">
          <h1>Create Account</h1>
          <p>Register to use the Exam Seating System</p>
        </div>

        <form className="login-form" onSubmit={handleSignup}>

          <div className="form-group">

            <label>Select Role</label>

            <select
              className="form-control"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
            >

              <option value="">Select Role</option>
              <option value="Student">Student</option>
              <option value="Teacher">Teacher</option>

            </select>

          </div>

          <div className="form-group">

            <label>Username</label>

            <input
              type="text"
              className="form-control"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />

          </div>

          <div className="form-group">

            <label>Password</label>

            <input
              type="password"
              className="form-control"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

          </div>

          <button type="submit" className="login-btn">

            Create Account

          </button>

          <div className="signup-link">

            <p>

              Already have an account?

              <span
                onClick={() => navigate("/")}
                className="create-account"
              >

                Login

              </span>

            </p>

          </div>

        </form>

      </div>

    </div>

  );

}

export default Signup;