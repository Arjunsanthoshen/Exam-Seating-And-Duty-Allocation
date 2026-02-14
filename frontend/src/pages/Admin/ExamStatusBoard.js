import { Link } from "react-router-dom";
import "./ExamStatusBoard.css";

function ExamStatusBoard() {
  return (
    <div className="ExamStatusBoard">
      <h2>operations</h2>

        <Link to="/ManageRooms">
          <button>manage rooms</button>
        </Link>
    
    </div>
  );
}

export default ExamStatusBoard;
