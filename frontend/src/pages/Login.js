// import React, { useState } from "react";
// import { useNavigate } from "react-router-dom";
// import "./Login.css";

// function Login() {
//   const navigate = useNavigate();
//   const [role, setRole] = useState("");
//   const [username, setUsername] = useState("");
//   const [password, setPassword] = useState("");

//   const handleLogin = async (e) => {
//     e.preventDefault();

//     try {
//       const res = await fetch("http://localhost:5000/api/login", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ username, password, role })
//       });

//       const data = await res.json();

//       if (res.ok && data.success) {
//         // Convert role to lowercase to match navigate logic exactly
//         const userRole = data.role.toLowerCase();

//         if (userRole === "admin") navigate("/ExamStatusBoard");
//         else if (userRole === "teacher") navigate("/MyDutySchedule");
//         else if (userRole === "student") navigate("/ExamHall");
//       } else {
//         alert(data.message || "Invalid Login");
//       }
//     } catch (error) {
//       console.error("Login Error:", error);
//       alert("Server is not responding.");
//     }
//   };

//   return (
//     <div className="login-wrapper">
//       <div className="login-card">
//         <div className="login-header">
//           <h1>Exam Seating System</h1>
//           <p>Please enter your details to continue</p>
//         </div>

//         <form className="login-form" onSubmit={handleLogin}>
//           <div className="form-group">
//             <label>Select Role</label>
//             <select
//               className="form-control"
//               value={role}
//               onChange={(e) => setRole(e.target.value)}
//               required
//             >
//               <option value="">Select Role</option>
//               <option value="Admin">Admin</option>
//               <option value="Teacher">Teacher</option>
//               <option value="Student">Student</option>
//             </select>
//           </div>

//           <div className="form-group">
//             <label>Username (Email)</label>
//             <input
//               type="text"
//               className="form-control"
//               placeholder="user@sjcetpalai.ac.in"
//               value={username}
//               onChange={(e) => setUsername(e.target.value)}
//               required
//             />
//           </div>

//           <div className="form-group">
//             <label>Password</label>
//             <input
//               type="password"
//               className="form-control"
//               placeholder="Enter password"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//               required
//             />
//           </div>

//           <button type="submit" className="login-btn">Login</button>
//         </form>
//       </div>
//     </div>
//   );
// }

// export default Login;
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const [role, setRole] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // --- KEY CHANGE START ---
        // 1. Store the JWT token in LocalStorage
        if (data.accessToken) {
          localStorage.setItem("token", data.accessToken);
        } else {
          console.error("No token received from server");
        }
        // --- KEY CHANGE END ---

        const userRole = data.role.toLowerCase();

        // Navigate based on role
        if (userRole === "admin") navigate("/ExamStatusBoard");
        else if (userRole === "teacher") navigate("/MyDutySchedule");
        else if (userRole === "student") navigate("/ExamHall");
        
      } else {
        alert(data.message || "Invalid Login Credentials");
      }
    } catch (error) {
      console.error("Login Error:", error);
      alert("Server is not responding. Ensure the backend is running on port 5000.");
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <h1>Exam Seating System</h1>
          <p>Please enter your details to continue</p>
        </div>

        <form className="login-form" onSubmit={handleLogin}>
          <div className="form-group">
            <label>Select Role</label>
            <select
              className="form-control"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
            >
              <option value="">Select Role</option>
              <option value="Admin">Admin</option>
              <option value="Teacher">Teacher</option>
              <option value="Student">Student</option>
            </select>
          </div>

          <div className="form-group">
            <label>Username (Email)</label>
            <input
              type="text"
              className="form-control"
              placeholder="user@sjcetpalai.ac.in"
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

          <button type="submit" className="login-btn">Login</button>
        </form>
      </div>
    </div>
  );
}

export default Login;