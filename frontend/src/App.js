import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import ExamSchedule from "./pages/Admin/ExamSchedule";
import ExamStatus from "./pages/Admin/ExamStatusBoard";
import ManageRooms from "./pages/Admin/ManageRooms";
import ManageTeachers from "./pages/Admin/ManageTeachers";
import ManageStudents from "./pages/Admin/ManageStudents";
import MyDutySchedule from "./pages/Teacher/MyDutySchedule";
import ExamHall from "./pages/Student/ExamHall";
// import BackButton from "./components/BackButton";

const Placeholder = ({ title }) => (
  <div style={{ padding: "40px", backgroundColor: "#7ba6dc", minHeight: "100vh", color: "white" }}>
    {/* <BackButton />  */}
    <div style={{ background: "rgba(255,255,255,0.2)", padding: "50px", borderRadius: "15px" }}>
      <h2>{title} Page Coming Soon</h2>
    </div>
  </div>
);


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
        <Route path="/ExamSchedule" element={<ExamSchedule />} />
        <Route path="/GenerateSeating" element={<Placeholder title="Generate Seating" />} />
        <Route path="/GenerateDuties" element={<Placeholder title="Generate Duties" />} />
        <Route path="/Reports" element={<Placeholder title="Reports" />} />
        
        {/* Teacher Routes */}
        <Route path="/MyDutySchedule" element={<MyDutySchedule />} />
        
        {/* Student Routes */}
        <Route path="/ExamHall" element={<ExamHall />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;