import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import ExamStatus from "./pages/Admin/ExamStatusBoard";
import MyDutySchedule from "./pages/Teacher/MyDutySchedule";
import ExamHall from "./pages/Student/ExamHall";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/admin" element={<ExamStatus />} />
        <Route path="/teacher" element={<MyDutySchedule />} />
        <Route path="/student" element={<ExamHall />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
