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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route path="/ExamStatusBoard" element={<ExamStatus />} />
        <Route path="/ManageStudents" element={<ManageStudents />} />
        <Route path="/ManageTeachers" element={<ManageTeachers />} />
        <Route path="/ManageRooms" element={<ManageRooms />} />
        <Route path="/ExamSchedule" element={<ExamSchedule />} />
        <Route path="/GenerateSeating" element={<GenerateSeating />} />
        <Route path="/GenerateDuties" element={<GenerateDuties />} />
        <Route path="/Reports" element={<Reports />} />
        <Route path="/Requests" element={<Requests />} />

        <Route path="/MyDutySchedule" element={<MyDutySchedule />} />
        <Route path="/MarkUnavailability" element={<MarkUnavailability />} />

        <Route path="/ExamHall" element={<ExamHall />} />
        <Route path="/StudentProfile" element={<StudentProfilePage />} />
        <Route path="/ExamTimeTable" element={<ExamTimeTable />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
