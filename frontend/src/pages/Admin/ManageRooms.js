import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ManageRooms.css';

const ManageRooms = () => {
    const [rooms, setRooms] = useState([]);
    const [formData, setFormData] = useState({
        block: '', room_no: '', capacity: 30, cap_per_bench: 1,
        col1: 0, col2: 0, col3: 0, col4: 0, col5: 0
    });

    const benchOptions = ["Nil", 5, 6, 7, 8, 9, 10];
    const blockOptions = ["MTB", "SJB", "SJPB", "SPB", "SFB"];

    useEffect(() => {
        fetchRooms();
    }, []);

    const fetchRooms = async () => {
        const res = await axios.get('http://localhost:5000/api/rooms');
        setRooms(res.data);
    };

    const handleSave = async () => {
        if (!formData.room_no || !formData.block) return alert("Please fill Room No and Block");
        await axios.post('http://localhost:5000/api/rooms', formData);
        fetchRooms(); // Refresh table immediately
    };

    const handleEdit = (room) => {
        setFormData(room);
    };

    return (
        <div className="manage-rooms-container">
            <div className="form-card">
                <h3>Manage Rooms</h3>
                <div className="input-grid">
                    <div className="input-group">
                        <label>Block Name</label>
                        {/* <input value={formData.block} onChange={e => setFormData({...formData, block: e.target.value})} placeholder="e.g. MTB" /> */}
                        <select value={formData.block} onChange={e => setFormData({...formData, block: e.target.value})}>
                            <option value="">Select Block</option>
                            {blockOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                    <div className="input-group">
                        <label>Room No.</label>
                        <input type="number" value={formData.room_no} onChange={e => setFormData({...formData, room_no: e.target.value})} />
                    </div>
                    <div className="input-group">
                        <label>Capacity</label>
                        <select value={formData.capacity} onChange={e => setFormData({...formData, capacity: e.target.value})}>
                            <option value={30}>30</option>
                            <option value={60}>60</option>
                        </select>
                    </div>
                    <div className="input-group">
                        <label>Students per Bench</label>
                        <div className="toggle-group">
                            <button 
                                type="button"
                                className={`toggle-btn ${formData.cap_per_bench === 1 ? 'active' : ''}`} 
                                onClick={() => setFormData({...formData, cap_per_bench: 1})}
                            >1</button>
                            <button 
                                type="button"
                                className={`toggle-btn ${formData.cap_per_bench === 2 ? 'active' : ''}`} 
                                onClick={() => setFormData({...formData, cap_per_bench: 2})}
                            >2</button>
                        </div>
                    </div>
                </div>

                <h4>Benches Per Column</h4>
                <div className="benches-grid">
                    {[1, 2, 3, 4, 5].map(num => (
                        <div key={num} className="input-group">
                            <label>Col {num}</label>
                            <select 
                                value={formData[`col${num}`]} 
                                onChange={e => setFormData({...formData, [`col${num}`]: e.target.value === "Nil" ? 0 : parseInt(e.target.value)})}
                            >
                                {benchOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                    ))}
                </div>

                <button className="save-btn" onClick={handleSave}>Save Room</button>
            </div>

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Block Name</th><th>Room No.</th><th>Capacity</th><th>Students/Bench</th>
                            <th>Col1</th><th>Col2</th><th>Col3</th><th>Col4</th><th>Col5</th><th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rooms.map((room) => (
                            <tr key={room.room_no}>
                                <td>{room.block}</td><td>{room.room_no}</td><td>{room.capacity}</td>
                                <td>{room.cap_per_bench}</td><td>{room.col1 || 'Nil'}</td><td>{room.col2 || 'Nil'}</td>
                                <td>{room.col3 || 'Nil'}</td><td>{room.col4 || 'Nil'}</td><td>{room.col5 || 'Nil'}</td>
                                <td><span className="edit-icon" onClick={() => handleEdit(room)}>✎</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ManageRooms;