import React from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";

const BackButton = () => {
  const navigate = useNavigate();
  return (
    <button 
      onClick={() => navigate(-1)} 
      style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: "10px 20px", backgroundColor: "#5b87c4",
        color: "white", border: "none", borderRadius: "8px",
        cursor: "pointer", marginBottom: "20px", fontWeight: "bold",
        transition: "0.3s"
      }}
      onMouseOver={(e) => e.target.style.backgroundColor = "#4a74b1"}
      onMouseOut={(e) => e.target.style.backgroundColor = "#5b87c4"}
    >
      <FaArrowLeft /> Back
    </button>
  );
};

export default BackButton;