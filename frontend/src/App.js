import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ExamSchedule from "./pages/Admin/ExamSchedule";
import ExamStatus from "./pages/Admin/ExamStatusBoard";
import ManageRooms from "./pages/Admin/ManageRooms";
import ManageTeachers from "./pages/Admin/ManageTeachers";
import ManageStudents from "./pages/Admin/ManageStudents";
import GenerateSeating from "./pages/Admin/GenerateSeating";
import GenerateDuties from "./pages/Admin/GenerateDuties";
import Reports from "./pages/Admin/Reports";
import Requests from "./pages/Admin/Requests";
import MyDutySchedule from "./pages/Teacher/MyDutySchedule";
import MarkUnavailability from "./pages/Teacher/MarkUnavailability";
import ExamHall from "./pages/Student/ExamHall";
import StudentProfilePage from "./pages/Student/StudentProfilePage";
import ExamTimeTable from "./pages/Student/ExamTimeTable";

import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Admin Protected Routes */}
        <Route path="/ExamStatusBoard" element={<ProtectedRoute allowedRole="admin"><ExamStatus /></ProtectedRoute>} />
        <Route path="/ManageStudents" element={<ProtectedRoute allowedRole="admin"><ManageStudents /></ProtectedRoute>} />
        <Route path="/ManageTeachers" element={<ProtectedRoute allowedRole="admin"><ManageTeachers /></ProtectedRoute>} />
        <Route path="/ManageRooms" element={<ProtectedRoute allowedRole="admin"><ManageRooms /></ProtectedRoute>} />
        <Route path="/ExamSchedule" element={<ProtectedRoute allowedRole="admin"><ExamSchedule /></ProtectedRoute>} />
        <Route path="/GenerateSeating" element={<ProtectedRoute allowedRole="admin"><GenerateSeating /></ProtectedRoute>} />
        <Route path="/GenerateDuties" element={<ProtectedRoute allowedRole="admin"><GenerateDuties /></ProtectedRoute>} />
        <Route path="/Reports" element={<ProtectedRoute allowedRole="admin"><Reports /></ProtectedRoute>} />
        <Route path="/Requests" element={<ProtectedRoute allowedRole="admin"><Requests /></ProtectedRoute>} />

        {/* Teacher Protected Routes */}
        <Route path="/MyDutySchedule" element={<ProtectedRoute allowedRole="teacher"><MyDutySchedule /></ProtectedRoute>} />
        <Route path="/MarkUnavailability" element={<ProtectedRoute allowedRole="teacher"><MarkUnavailability /></ProtectedRoute>} />

        {/* Student Protected Routes */}
        <Route path="/ExamHall" element={<ProtectedRoute allowedRole="student"><ExamHall /></ProtectedRoute>} />
        <Route path="/StudentProfile" element={<ProtectedRoute allowedRole="student"><StudentProfilePage /></ProtectedRoute>} />
        <Route path="/ExamTimeTable" element={<ProtectedRoute allowedRole="student"><ExamTimeTable /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
