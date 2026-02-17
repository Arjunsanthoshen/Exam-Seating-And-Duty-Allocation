import React from 'react';
import BackButton from '../../components/BackButton'; // Adjust path if needed

const ExamHall = () => {
  return (
    <div style={{ padding: '20px' }}>
      <BackButton />
      <h1>Exam Hall Dashboard</h1>
      <div className="card">
        <h3>Current Exam Status</h3>
        <p>Welcome to the Exam Hall portal. Here you can view your seating and hall details.</p>
      </div>
    </div>
  );
};

export default ExamHall; // Critical line