import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AdminSidebar from './AdminSidebar'; 
import { FaEdit, FaTrash, FaPlus, FaMinus } from 'react-icons/fa';
import './ManageRooms.css';

const ManageRooms = () => {
    const [rooms, setRooms] = useState([]);
    const [formData, setFormData] = useState({
        block: '', room_no: '', capacity: 30, cap_per_bench: 1,
        col1: 0, col2: 0, col3: 0, col4: 0, col5: 0
    });
    const [blocks, setBlocks] = useState([]);
    const [newBlockName, setNewBlockName] = useState("");
    const benchOptions = ["Nil", 5, 6, 7, 8, 9, 10];
    // const blockOptions = ["MTB", "SJB", "SJPB", "SPB", "SFB"];

    useEffect(() => {
        fetchRooms();
        fetchBlocks();
    }, []);

    const fetchBlocks = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/blocks');
            setBlocks(res.data);
        } catch (err) {
            console.error("Error fetching blocks", err);
        }
    };

    const blockOptions = blocks.map(b => b.block_name);

    const handleAddBlock = async () => {
        if (!newBlockName.trim()) return alert("Enter a block name");
        try {
            await axios.post('http://localhost:5000/api/blocks', { block_name: newBlockName.toUpperCase() });
            setNewBlockName("");
            fetchBlocks();
            alert("Block added!");
        } catch (err) {
            alert(err.response?.data?.message || "Error adding block");
        }
    };

    const handleDeleteBlock = async () => {
        if (!newBlockName.trim()) return alert("Enter block name to delete");
        if (window.confirm(`Delete block ${newBlockName}?`)) {
            try {
                await axios.delete(`http://localhost:5000/api/blocks/${newBlockName.toUpperCase()}`);
                setNewBlockName("");
                fetchBlocks();
                alert("Block removed!");
            } catch (err) {
                alert("Error deleting block. Ensure it's not in use.");
            }
        }
    };

    const fetchRooms = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/rooms');
            setRooms(res.data);
        } catch (err) {
            console.error("Error fetching rooms", err);
        }
    };

    const handleSave = async () => {
        if (!formData.room_no || !formData.block) return alert("Please fill Room No and Block");
        try {
            await axios.post('http://localhost:5000/api/rooms', formData);
            alert("Room saved successfully!");
            setFormData({
                block: '', room_no: '', capacity: 30, cap_per_bench: 1,
                col1: 0, col2: 0, col3: 0, col4: 0, col5: 0
            });
            fetchRooms(); 
        } catch (err) {
            alert("Error saving room");
        }
    };

    const handleEdit = (room) => {
        setFormData(room);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (block, room_no) => {
        if (window.confirm(`Are you sure you want to delete room ${room_no} in block ${block}?`)) {
            try {
                // Updated to pass both block and room_no in the URL
                await axios.delete(`http://localhost:5000/api/rooms/${block}/${room_no}`);
                alert("Room deleted successfully");
                fetchRooms(); // Refresh the table
            } catch (err) {
                console.error("Delete Error:", err);
                alert("Failed to delete room");
            }
        }
    };

    return (
        <div className="dashboard-container">
            <AdminSidebar />
            
            <main className="main-content">
                <div className="manage-card">
                    <h2 className="card-title">Manage Rooms</h2>
                    <div className="block-management-section">
                        <h4 className="sub-title">Block Management</h4>
                        <div className="block-controls">
                            <input 
                                type="text" 
                                className="main-input block-input"
                                placeholder="Enter block name (e.g. MTB)" 
                                value={newBlockName} 
                                onChange={(e) => setNewBlockName(e.target.value)} 
                            />
                            <button className="icon-btn add-btn" onClick={handleAddBlock} title="Add Block">
                                <FaPlus />
                            </button>
                            <button className="icon-btn remove-btn" onClick={handleDeleteBlock} title="Delete Block">
                                <FaMinus />
                            </button>
                        </div>
                    </div>
                    <div className="form-section">
                        <div className="input-grid">
                            <div className="input-box">
                                <label>Block Name</label>
                                <select 
                                    value={formData.block} 
                                    onChange={e => setFormData({...formData, block: e.target.value})}
                                >
                                    <option value="">Select Block</option>
                                    {blockOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>

                            <div className="input-box">
                                <label>Room No.</label>
                                <input 
                                    type="number" 
                                    value={formData.room_no} 
                                    onChange={e => setFormData({...formData, room_no: e.target.value})} 
                                    placeholder="e.g. 101"
                                    onWheel={(e) => e.target.blur()} 
                                />
                            </div>

                            <div className="input-box">
                                <label>Total Capacity</label>
                                <select 
                                    value={formData.capacity} 
                                    onChange={e => setFormData({...formData, capacity: e.target.value})}
                                >
                                    <option value={30}>30 Students</option>
                                    <option value={60}>60 Students</option>
                                </select>
                            </div>

                            <div className="input-box">
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

                        <h4 className="sub-title">Benches Per Column</h4>
                        <div className="benches-grid">
                            {[1, 2, 3, 4, 5].map(num => (
                                <div key={num} className="input-box">
                                    <label>Col {num}</label>
                                    <select 
                                        value={formData[`col${num}`]} 
                                        onChange={e => setFormData({
                                            ...formData, 
                                            [`col${num}`]: e.target.value === "Nil" ? 0 : parseInt(e.target.value)
                                        })}
                                    >
                                        {benchOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>

                        <div className="action-row">
                            <button className="submit-batch-btn small-btn" onClick={handleSave}>
                                Save Room Configuration
                            </button>
                        </div>
                    </div>

                    <div className="table-section">
                        <table className="student-table">
                            <thead>
                                <tr>
                                    <th>Block</th>
                                    <th>Room</th>
                                    <th>Cap.</th>
                                    <th>S/B</th>
                                    <th>C1</th>
                                    <th>C2</th>
                                    <th>C3</th>
                                    <th>C4</th>
                                    <th>C5</th>
                                    <th>Actions</th> {/* Renamed from Edit */}
                                </tr>
                            </thead>
                            <tbody>
                                {rooms.map((room) => (
                                    <tr key={`${room.block}-${room.room_no}`}>
                                        <td>{room.block}</td>
                                        <td>{room.room_no}</td>
                                        <td>{room.capacity}</td>
                                        <td>{room.cap_per_bench}</td>
                                        <td>{room.col1 || '0'}</td>
                                        <td>{room.col2 || '0'}</td>
                                        <td>{room.col3 || '0'}</td>
                                        <td>{room.col4 || '0'}</td>
                                        <td>{room.col5 || '0'}</td>
                                        <td className="action-cell">
                                            <FaEdit 
                                                className="edit-btn" 
                                                onClick={() => handleEdit(room)} 
                                                title="Edit"
                                            />
                                            <FaTrash 
                                                className="delete-btn" 
                                                onClick={() => handleDelete(room.block, room.room_no)} 
                                                title="Delete"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ManageRooms;