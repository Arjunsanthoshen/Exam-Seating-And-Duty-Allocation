import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';

const BackButton = () => {
  const navigate = useNavigate();
  return (
    <button 
      onClick={() => navigate(-1)} 
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 15px',
        backgroundColor: '#5b87c4',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontSize: '0.9rem',
        marginBottom: '20px'
      }}
    >
      <FaArrowLeft /> Back
    </button>
  );
};

export default BackButton;