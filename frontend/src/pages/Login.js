import React from "react";
import "./Login.css"; // Make sure to import the CSS file

function Login() {
  return (
    <div className="login-wrapper">
      <div className="login-card">
        {/* Header Section */}
        <div className="login-header">
          <h1>Exam Seating System</h1>
          <p>Please enter your details to continue</p>
        </div>

        {/* Form Section */}
        <form className="login-form" onSubmit={(e) => e.preventDefault()}>
          <div className="form-group">
            <label htmlFor="role">Select Role</label>
            <select id="role" className="form-control">
              <option value="" disabled selected>Select Role</option>
              <option value="admin">Admin</option>
              <option value="teacher">Teacher</option>
              <option value="student">Student</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="username">Username / Email</label>
            <input 
              id="username"
              type="text" 
              className="form-control" 
              placeholder="e.g. johndoe2027@sjcetpalai.ac.in" 
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input 
              id="password"
              type="password" 
              className="form-control" 
              placeholder="Enter your password" 
            />
          </div>

          <button type="submit" className="login-btn">
            Login
          </button>
        </form>
        
        <div className="login-footer">
          <p>Forgot Password? <button type="button" className="link-btn">That's Your Fault</button></p>
        </div>
      </div>
    </div>
  );
}

export default Login;