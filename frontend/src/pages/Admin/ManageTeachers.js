import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";

const BackButton = () => {
  const navigate = useNavigate();
  return (
    <button 
      onClick={() => navigate(-1)} 
      style={{
        display: "flex", alignItems: "center", gap: "8px",
        padding: "10px 18px", backgroundColor: "#4a74b1",
        color: "white", border: "none", borderRadius: "8px",
        cursor: "pointer", marginBottom: "20px", fontWeight: "600",
        boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
      }}
    >
      <FaArrowLeft /> Back
    </button>
  );
};

export default BackButton;