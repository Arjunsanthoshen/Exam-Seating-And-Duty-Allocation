import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import ExamStatus from "./pages/Admin/ExamStatusBoard";
import ManageRooms from "./pages/Admin/ManageRooms";
import ManageTeachers from "./pages/Admin/ManageTeachers";
import ManageStudents from "./pages/Admin/ManageStudents";
import MyDutySchedule from "./pages/Teacher/MyDutySchedule";
import ExamHall from "./pages/Student/ExamHall";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        
        {/* Admin Routes */}
        <Route path="/ExamStatusBoard" element={<ExamStatus />} />
        <Route path="/ManageStudents" element={<ManageStudents />} />
        <Route path="/ManageTeachers" element={<ManageTeachers />} />
        <Route path="/ManageRooms" element={<ManageRooms />} />
        
        {/* Teacher Routes */}
        <Route path="/MyDutySchedule" element={<MyDutySchedule />} />
        
        {/* Student Routes */}
        <Route path="/ExamHall" element={<ExamHall />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;