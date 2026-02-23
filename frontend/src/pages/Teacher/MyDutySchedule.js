import React from 'react';
import BackButton from '../../components/BackButton';

const MyDutySchedule = () => {
  return (
    <div style={{ padding: '20px' }}>
      <BackButton />
      <h1>My Duty Schedule</h1>
      <p>View and manage your assigned exam duties here.</p>
      <table border="1" style={{ width: '100%', marginTop: '20px', textAlign: 'left' }}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Hall No</th>
            <th>Session</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>No duties assigned yet</td>
            <td>-</td>
            <td>-</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default MyDutySchedule; // Critical line