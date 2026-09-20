import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AdminSidebar from './AdminSidebar'; 
import { API_BASE_URL } from '../../api/config';
import { 
  FaDoorOpen, FaPlus, FaMinus, FaEdit, FaTrash, 
  FaBuilding, FaChair, FaBolt, FaLayerGroup 
} from 'react-icons/fa';
import './ManageRooms.css';

const ManageRooms = () => {
    const [rooms, setRooms] = useState([]);
    const [formData, setFormData] = useState({
        block: '', room_no: '', capacity: 0, cap_per_bench: 1,
        col1: 0, col2: 0, col3: 0, col4: 0, col5: 0
    });
    const [blocks, setBlocks] = useState([]);
    const [newBlockName, setNewBlockName] = useState("");
    const [selectedBlockFilter, setSelectedBlockFilter] = useState("All");
    const benchOptions = ["Nil", 5, 6, 7, 8, 9, 10];

    useEffect(() => {
        fetchRooms();
        fetchBlocks();
    }, []);

    // Automatic calculation of Total Capacity based on columns and students per bench
    useEffect(() => {
        const totalBenches = 
            (parseInt(formData.col1) || 0) + 
            (parseInt(formData.col2) || 0) + 
            (parseInt(formData.col3) || 0) + 
            (parseInt(formData.col4) || 0) + 
            (parseInt(formData.col5) || 0);
        
        const calculatedCapacity = totalBenches * formData.cap_per_bench;

        setFormData(prev => ({
            ...prev,
            capacity: calculatedCapacity
        }));
    }, [formData.col1, formData.col2, formData.col3, formData.col4, formData.col5, formData.cap_per_bench]);

    const fetchBlocks = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/blocks`);
            setBlocks(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("Error fetching blocks", err);
            setBlocks([]);
        }
    };

    const blockOptions = (Array.isArray(blocks) ? blocks : []).map(b => b.block_name);

    const handleAddBlock = async () => {
        if (!newBlockName.trim()) return alert("Enter a block name");
        try {
            await axios.post(`${API_BASE_URL}/api/blocks`, { block_name: newBlockName.toUpperCase() });
            setNewBlockName("");
            fetchBlocks();
            alert("Block added successfully!");
        } catch (err) {
            alert(err.response?.data?.message || "Error adding block");
        }
    };

    const isDemoUser = localStorage.getItem("isDemo") === "true" || (localStorage.getItem("username") || "").toLowerCase() === "demo";

    const handleDeleteBlock = async () => {
        if (!newBlockName.trim()) return alert("Enter block name to delete");
        const blockObj = blocks.find(b => (b.block_name || "").toUpperCase() === newBlockName.trim().toUpperCase());
        if (isDemoUser && (!blockObj || !blockObj.is_demo)) {
            alert("Demo users cannot delete this data.");
            return;
        }

        if (window.confirm(`Delete block ${newBlockName.toUpperCase()}?`)) {
            try {
                await axios.delete(`${API_BASE_URL}/api/blocks/${newBlockName.toUpperCase()}`);
                setNewBlockName("");
                fetchBlocks();
                alert("Block removed successfully!");
            } catch (err) {
                alert(err.response?.data?.message || "Error deleting block. Ensure it has no assigned rooms.");
            }
        }
    };

    const fetchRooms = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/rooms`);
            setRooms(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("Error fetching rooms", err);
            setRooms([]);
        }
    };

    // Smart Automation: Standard 50-Seat Room Preset (10 benches per col, 5 cols, 1 student/bench)
    const handleApplyStandardPreset = () => {
        setFormData(prev => ({
            ...prev,
            cap_per_bench: 1,
            col1: 10,
            col2: 10,
            col3: 10,
            col4: 10,
            col5: 10
        }));
    };

    // Smart Automation: Standard 40-Seat Room Preset (8 benches per col, 5 cols, 1 student/bench)
    const handleApply40SeatPreset = () => {
        setFormData(prev => ({
            ...prev,
            cap_per_bench: 1,
            col1: 8,
            col2: 8,
            col3: 8,
            col4: 8,
            col5: 8
        }));
    };

    const handleSave = async () => {
        if (!formData.room_no || !formData.block) return alert("Please specify both Block and Room Number");
        try {
            await axios.post(`${API_BASE_URL}/api/rooms`, formData);
            alert("Room configuration saved successfully!");
            setFormData({
                block: '', room_no: '', capacity: 0, cap_per_bench: 1,
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
        const roomObj = rooms.find(r => r.block === block && String(r.room_no) === String(room_no));
        if (isDemoUser && (!roomObj || !roomObj.is_demo)) {
            alert("Demo users cannot delete this data.");
            return;
        }

        if (window.confirm(`Are you sure you want to delete room ${room_no} in block ${block}?`)) {
            try {
                await axios.delete(`${API_BASE_URL}/api/rooms/${block}/${room_no}`);
                alert("Room deleted successfully");
                fetchRooms(); 
            } catch (err) {
                console.error("Delete Error:", err);
                alert(err.response?.data?.message || "Failed to delete room");
            }
        }
    };

    const totalCapacity = rooms.reduce((acc, r) => acc + (parseInt(r.capacity) || 0), 0);
    const filteredRooms = rooms.filter(r => {
        if (selectedBlockFilter === "All") return true;
        return r.block === selectedBlockFilter;
    });

    return (
        <div className="admin-page-container">
            <AdminSidebar />
            
            <main className="admin-main-viewport">
                {/* Header */}
                <header className="admin-header-glass">
                    <div className="admin-header-left">
                        <div className="admin-context-pill">
                            <FaDoorOpen /> INFRASTRUCTURE & CAPACITY
                        </div>
                        <h1>Exam Halls & Room Manager</h1>
                        <p className="admin-header-sub">
                            Configure campus examination blocks, room column layouts, and seating capacity.
                        </p>
                    </div>

                    <div className="teacher-header-stats">
                        <div className="stat-pill-item">
                            <span className="stat-num">{rooms.length}</span>
                            <span className="stat-label">Total Rooms</span>
                        </div>
                        <div className="stat-pill-item available">
                            <span className="stat-num">{totalCapacity}</span>
                            <span className="stat-label">Total Seats</span>
                        </div>
                        <div className="stat-pill-item">
                            <span className="stat-num">{blockOptions.length}</span>
                            <span className="stat-label">Campus Blocks</span>
                        </div>
                    </div>
                </header>

                {/* Configuration Glass Panel */}
                {/* Configuration Form Panel (Compact & Efficient) */}
                <section className="admin-glass-panel room-form-panel">
                        <div className="admin-panel-head">
                            <div className="panel-title-group">
                                <h2>Configure Examination Hall</h2>
                                <p>Manage blocks, room identifiers, and bench column distribution</p>
                            </div>

                            {/* Quick Presets */}
                            <div className="schedule-header-actions">
                                <button
                                    type="button"
                                    className="smart-copy-btn"
                                    onClick={handleApplyStandardPreset}
                                    title="Auto-fill 10 benches across 5 columns (50 seats)"
                                >
                                    <FaBolt /> 50-Seat Standard
                                </button>
                                <button
                                    type="button"
                                    className="smart-copy-btn"
                                    onClick={handleApply40SeatPreset}
                                    title="Auto-fill 8 benches across 5 columns (40 seats)"
                                >
                                    <FaBolt /> 40-Seat Standard
                                </button>
                            </div>
                        </div>

                        {/* Block Quick Management */}
                        <div className="block-manage-strip">
                            <span className="strip-title"><FaBuilding /> Campus Block Registry:</span>
                            <div className="strip-input-group">
                                <input 
                                    type="text" 
                                    className="admin-glass-input"
                                    placeholder="Add/Remove block (e.g. MTB)" 
                                    value={newBlockName} 
                                    onChange={(e) => setNewBlockName(e.target.value)} 
                                />
                                <button type="button" className="strip-btn add" onClick={handleAddBlock} title="Add Block">
                                    <FaPlus /> Add
                                </button>
                                <button type="button" className="strip-btn remove" onClick={handleDeleteBlock} title="Delete Block">
                                    <FaMinus /> Del
                                </button>
                            </div>
                        </div>

                        {/* Room Form Grid */}
                        <div className="schedule-config-grid compact-config">
                            <div className="config-box">
                                <label>Campus Block</label>
                                <select 
                                    className="admin-glass-select"
                                    value={formData.block} 
                                    onChange={e => setFormData({...formData, block: e.target.value})}
                                >
                                    <option value="">Select Block</option>
                                    {blockOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>

                            <div className="config-box">
                                <label>Room Number</label>
                                <input 
                                    type="number" 
                                    className="admin-glass-input"
                                    value={formData.room_no} 
                                    onChange={e => setFormData({...formData, room_no: e.target.value})} 
                                    placeholder="e.g. 101"
                                    onWheel={(e) => e.target.blur()} 
                                />
                            </div>

                            <div className="config-box">
                                <label>Capacity per Bench</label>
                                <div className="session-toggle-box">
                                    <button 
                                        type="button"
                                        className={`sess-btn ${formData.cap_per_bench === 1 ? 'active' : ''}`} 
                                        onClick={() => setFormData({...formData, cap_per_bench: 1})}
                                    >
                                        1 Student
                                    </button>
                                    <button 
                                        type="button"
                                        className={`sess-btn ${formData.cap_per_bench === 2 ? 'active' : ''}`} 
                                        onClick={() => setFormData({...formData, cap_per_bench: 2})}
                                    >
                                        2 Students
                                    </button>
                                </div>
                            </div>

                            <div className="config-box">
                                <label>Computed Capacity</label>
                                <div className="auto-capacity-chip">
                                    <FaChair />
                                    <span>{formData.capacity} Student Seats</span>
                                </div>
                            </div>
                        </div>

                        {/* Columns Matrix */}
                        <div className="branches-courses-container">
                            <div className="branch-grid-title">
                                <FaLayerGroup className="icon-book" />
                                <span>Benches per Column Distribution</span>
                            </div>

                            <div className="columns-selector-grid">
                                {[1, 2, 3, 4, 5].map(num => (
                                    <div key={num} className="column-selector-card">
                                        <span className="col-label">Column {num}</span>
                                        <select 
                                            className="admin-glass-select"
                                            value={formData[`col${num}`]} 
                                            onChange={e => setFormData({
                                                ...formData, 
                                                [`col${num}`]: e.target.value === "Nil" ? 0 : parseInt(e.target.value)
                                            })}
                                        >
                                            {benchOptions.map(opt => <option key={opt} value={opt}>{opt} benches</option>)}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="schedule-form-actions">
                            <button type="button" className="action-btn primary full-w" onClick={handleSave}>
                                Save Room Configuration
                            </button>
                        </div>
                    </section>

                    {/* Right: Rooms Roster Table (Visible without scrolling) */}
                    <section className="admin-glass-panel room-table-panel">
                        <div className="admin-panel-head">
                            <div className="panel-title-group">
                                <h2>Campus Rooms Roster</h2>
                                <p>{rooms.length} configured halls ready for seating generation</p>
                            </div>

                            {/* Block Filters */}
                            <div className="dept-pills-row">
                                <button
                                    type="button"
                                    className={`dept-pill ${selectedBlockFilter === "All" ? 'active' : ''}`}
                                    onClick={() => setSelectedBlockFilter("All")}
                                >
                                    All Blocks
                                </button>
                                {blockOptions.map(b => (
                                    <button
                                        key={b}
                                        type="button"
                                        className={`dept-pill ${selectedBlockFilter === b ? 'active' : ''}`}
                                        onClick={() => setSelectedBlockFilter(b)}
                                    >
                                        {b}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="admin-table-scroll room-table-scroll">
                            <table className="admin-modern-table rooms-table">
                                <thead>
                                    <tr>
                                        <th className="th-center">Block</th>
                                        <th className="th-center">Room</th>
                                        <th className="th-center">Capacity</th>
                                        <th className="th-center">Per Bench</th>
                                        <th className="th-center">Col 1</th>
                                        <th className="th-center">Col 2</th>
                                        <th className="th-center">Col 3</th>
                                        <th className="th-center">Col 4</th>
                                        <th className="th-center">Col 5</th>
                                        <th className="th-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRooms.length > 0 ? (
                                        filteredRooms.map((room) => (
                                            <tr key={`${room.block}-${room.room_no}`}>
                                                <td className="td-center">
                                                    <strong className="branch-tag">{room.block}</strong>
                                                </td>
                                                <td className="td-center">
                                                    <span className="room-num-badge">Room {room.room_no}</span>
                                                </td>
                                                <td className="td-center">
                                                    <span className="capacity-pill-tag">
                                                        <FaChair /> {room.capacity}
                                                    </span>
                                                </td>
                                                <td className="td-center">{room.cap_per_bench}</td>
                                                <td className="td-center">{room.col1 || '0'}</td>
                                                <td className="td-center">{room.col2 || '0'}</td>
                                                <td className="td-center">{room.col3 || '0'}</td>
                                                <td className="td-center">{room.col4 || '0'}</td>
                                                <td className="td-center">{room.col5 || '0'}</td>
                                                <td className="td-center">
                                                    <div className="table-actions-group" style={{ justifyContent: 'center' }}>
                                                        <button 
                                                            type="button" 
                                                            className="edit-icon-btn" 
                                                            onClick={() => handleEdit(room)}
                                                            title="Edit room configuration"
                                                        >
                                                            <FaEdit />
                                                        </button>
                                                        <button 
                                                            type="button" 
                                                            className="delete-icon-btn" 
                                                            onClick={() => handleDelete(room.block, room.room_no)}
                                                            title="Delete room"
                                                        >
                                                            <FaTrash />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="10" className="admin-empty-cell">
                                                <p>No rooms configured for this block.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
            </main>
        </div>
    );
};

export default ManageRooms;