import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './GenerateSeating.css';
import AdminSidebar from './AdminSidebar'; 

const Allocation = () => {
    const [rooms, setRooms] = useState([]); 
    const [studentData, setStudentData] = useState([]); 
    const [searchQuery, setSearchQuery] = useState("");
    
    // Form States
    const [examDate, setExamDate] = useState("");
    const [session, setSession] = useState("FN");
    const [selectedYears, setSelectedYears] = useState([]);
    const [selectedRooms, setSelectedRooms] = useState([]);

    useEffect(() => {
        const init = async () => {
            try {
                const res = await axios.get('http://localhost:5000/api/allocation/init');
                setRooms(res.data.rooms || []);
                setStudentData(res.data.students || res.data.studentData || []);

                const savedRes = await axios.get('http://localhost:5000/api/allocation/saved-state');
                
                if (savedRes.data) {
                    const { examDate, session, selectedYears, selectedRooms } = savedRes.data;
                    if (examDate) {
                        setExamDate(new Date(examDate).toISOString().split('T')[0]);
                    }
                    setSession(session || "FN");
                    setSelectedYears(selectedYears ? selectedYears.map(Number) : []);
                    setSelectedRooms(selectedRooms || []);
                } else {
                    if (res.data.rooms) {
                        setSelectedRooms(res.data.rooms.map(r => `${r.block}${r.room_no}`));
                    }
                }
            } catch (err) {
                console.error("Initialization failed", err);
            }
        };
        init();
    }, []);

    const toggleYear = (year) => {
        const yearNum = Number(year);
        setSelectedYears(prev => 
            prev.includes(yearNum) ? prev.filter(y => y !== yearNum) : [...prev, yearNum]
        );
    };

    const toggleRoom = (roomId) => {
        setSelectedRooms(prev => 
            prev.includes(roomId) ? prev.filter(id => id !== roomId) : [...prev, roomId]
        );
    };

    // New Function: Select All / Deselect All for currently displayed filtered rooms
    const handleSelectAll = () => {
        const filteredIds = filteredRooms.map(r => `${r.block}${r.room_no}`);
        
        // If all filtered rooms are already selected, deselect them
        const allSelected = filteredIds.every(id => selectedRooms.includes(id));
        
        if (allSelected) {
            setSelectedRooms(prev => prev.filter(id => !filteredIds.includes(id)));
        } else {
            // Otherwise, add any missing filtered rooms to the selection
            setSelectedRooms(prev => [...new Set([...prev, ...filteredIds])]);
        }
    };

    const totalStudents = (studentData || [])
        .filter(s => selectedYears.includes(Number(s.academic_year)))
        .reduce((sum, s) => sum + parseInt(s.total_students || 0, 10), 0);

    const totalCapacity = (rooms || [])
        .filter(r => selectedRooms.includes(`${r.block}${r.room_no}`))
        .reduce((sum, r) => sum + parseInt(r.capacity || 0, 10), 0);

    const filteredRooms = (rooms || []).filter(r => 
        `${r.block}${r.room_no}`.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSaveSelection = async () => {
        const payload = { examDate, session, selectedYears, selectedRooms };
        try {
            await axios.post('http://localhost:5000/api/allocation/save', payload);
            alert("Selection saved successfully!");
        } catch (err) {
            alert("Failed to save selection.");
        }
    };

    const handleGenerateAllocation = async () => {
        // Added selectedRooms to the payload
        const payload = { examDate, session, selectedYears, selectedRooms };
        
        // Basic validation before sending
        if (!examDate || selectedYears.length === 0 || selectedRooms.length === 0) {
            alert("Please ensure Exam Date, Years, and Rooms are all selected.");
            return;
        }

        try {
            const response = await axios.post('http://localhost:5000/api/allocation/generate', payload);
            alert(response.data.message + " Total students: " + response.data.totalAllocated);
        } catch (err) {
            console.error("Generation Error:", err);
            const errorMsg = err.response?.data?.message || "Failed to generate allocation.";
            alert(errorMsg);
        }
    };

    return (
        <div className="dashboard-container">
          <AdminSidebar />
        <div className="manage-card">
            <h2 className="card-title">Generate Seating Allocation</h2>
            
            <div className="input-grid">
                <div className="input-box">
                    <label>Exam Date</label>
                    <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} />
                </div>
                <div className="input-box">
                    <label>Session</label>
                    <select value={session} onChange={e => setSession(e.target.value)}>
                        <option value="FN">FN</option>
                        <option value="AN">AN</option>
                        <option value="Both">Both</option>
                    </select>
                </div>
                <div className="input-box">
                    <label>Year Selection</label>
                    <div className="year-btn-group">
                        {[1, 2, 3, 4].map(y => (
                            <button 
                                key={y} 
                                className={`year-btn ${selectedYears.includes(y) ? 'active' : ''}`}
                                onClick={() => toggleYear(y)}
                            >{y}</button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="allocation-container">
                <div className="rooms-selection-card">
                    {/* Header with Select All Button */}
                    <div className="selection-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h4 style={{ margin: 0 }}>Select Exam Halls</h4>
                        <button 
                            className="select-all-btn" 
                            onClick={handleSelectAll}
                            style={{ padding: '5px 10px', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '4px', border: '1px solid #cbd5e0', background: '#f8fafc' }}
                        >
                            {filteredRooms.every(r => selectedRooms.includes(`${r.block}${r.room_no}`)) ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>

                    <input 
                        className="search-bar" 
                        placeholder="Search Room..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)} 
                    />
                    <div className="scrollable-rooms">
                        {filteredRooms.map(room => {
                            const id = `${room.block}${room.room_no}`;
                            return (
                                <div className="room-item" key={id}>
                                    <span>{id}</span>
                                    <label className="switch">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedRooms.includes(id)}
                                            onChange={() => toggleRoom(id)}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="totals-card">
                    <div className="summary-section">
                        <div className="stat-card">
                            <p>Total Students to Allocate:</p>
                            <h2>{totalStudents}</h2> 
                        </div>
                        <div className="stat-card">
                            <p>Total Capacity of Selected Rooms:</p>
                            <h2>{totalCapacity}</h2>
                        </div>
                        
                        {totalStudents > totalCapacity && (
                            <p style={{ color: 'red', fontWeight: 'bold', marginTop: '10px' }}>
                                Warning: Not enough capacity!
                            </p>
                        )}
                    </div>
                    
                    <div style={{marginTop: '20px', display: 'flex', gap: '10px'}}>
                        <button className="submit-batch-btn small-btn" onClick={handleSaveSelection}>
                            Save Selection
                        </button>
                        <button 
                            className="submit-batch-btn small-btn" 
                            style={{background: '#48bb78'}} 
                            onClick={handleGenerateAllocation}
                        >
                            Generate Allocation
                        </button>
                    </div>
                </div>
            </div>
        </div>
      </div>
    );
};

export default Allocation;