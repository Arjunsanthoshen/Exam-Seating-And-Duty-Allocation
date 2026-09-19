import React from "react";
import { Navigate, useLocation } from "react-router-dom";

/**
 * ProtectedRoute: Enforces client-side authentication and role-based access control.
 * Redirects unauthenticated users to /login and unauthorized users to their designated dashboard.
 */
function ProtectedRoute({ children, allowedRole, allowedRoles }) {
  const location = useLocation();
  const token = localStorage.getItem("token");
  const role = (localStorage.getItem("role") || "").trim().toLowerCase();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const rolesList = allowedRoles
    ? allowedRoles.map((r) => r.trim().toLowerCase())
    : allowedRole
    ? [allowedRole.trim().toLowerCase()]
    : [];

  if (rolesList.length > 0 && !rolesList.includes(role)) {
    // Redirect unauthorized user to their role-appropriate default page
    if (role === "admin") {
      return <Navigate to="/ExamStatusBoard" replace />;
    } else if (role === "teacher") {
      return <Navigate to="/MyDutySchedule" replace />;
    } else if (role === "student") {
      return <Navigate to="/ExamHall" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
