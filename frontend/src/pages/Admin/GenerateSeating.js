import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './GenerateSeating.css';
import AdminSidebar from './AdminSidebar'; 
import { FaChevronLeft, FaChevronRight, FaBolt, FaSpinner, FaTrash, FaCheckCircle } from 'react-icons/fa';

const Allocation = () => {
    const [rooms, setRooms] = useState([]); 
    const [studentData, setStudentData] = useState([]); 
    const [searchQuery, setSearchQuery] = useState("");
    const [scheduledDates, setScheduledDates] = useState([]);
    const [viewDate, setViewDate] = useState(new Date());
    
    // Form States
    const [examDate, setExamDate] = useState("");
    const [session, setSession] = useState("FN");
    const [selectedYears, setSelectedYears] = useState([]);
    const [selectedRooms, setSelectedRooms] = useState([]);
    const [isGenerated, setIsGenerated] = useState(false);

    // Loading Modal States
    const [isAllocating, setIsAllocating] = useState(false);
    const [allocationProgress, setAllocationProgress] = useState(0);
    const [allocationPhase, setAllocationPhase] = useState("");
    const [allocationSuccess, setAllocationSuccess] = useState(false);

    const getYYYYMMDD = (dateObj) => {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    // Auto-select minimum rooms to accommodate needed student seats
    const autoSelectRoomsForStudents = useCallback((targetStudents, roomList = rooms) => {
        if (!targetStudents || targetStudents <= 0 || !roomList || !roomList.length) {
            return [];
        }
        // Sort rooms by capacity desc, then block and room_no
        const sorted = [...roomList].sort((a, b) => {
            const capDiff = (b.capacity || 0) - (a.capacity || 0);
            if (capDiff !== 0) return capDiff;
            return `${a.block}${a.room_no}`.localeCompare(`${b.block}${b.room_no}`);
        });

        const chosen = [];
        let accumulated = 0;
        for (const r of sorted) {
            chosen.push(`${r.block}${r.room_no}`);
            accumulated += parseInt(r.capacity || 0, 10);
            if (accumulated >= targetStudents) {
                break;
            }
        }
        return chosen;
    }, [rooms]);

    const loadSavedSlotState = useCallback(async (date, sess, roomList = rooms, sData = studentData) => {
        if (!date || !sess) return;
        try {
            const res = await axios.get(`http://localhost:5000/api/allocation/saved-state?examDate=${date}&session=${sess}`);
            if (res.data) {
                setIsGenerated(Boolean(res.data.isGenerated));
                const loadedYears = res.data.selectedYears ? res.data.selectedYears.map(Number) : [];
                if (loadedYears.length > 0) {
                    setSelectedYears(loadedYears);
                } else {
                    setSelectedYears([1]);
                }
                
                if (res.data.selectedRooms && res.data.selectedRooms.length > 0) {
                    setSelectedRooms(res.data.selectedRooms);
                } else {
                    const activeYears = loadedYears.length > 0 ? loadedYears : [1];
                    const needed = (sData || [])
                        .filter(s => activeYears.includes(Number(s.academic_year)))
                        .reduce((sum, s) => sum + parseInt(s.total_students || 0, 10), 0);
                    setSelectedRooms(autoSelectRoomsForStudents(needed, roomList));
                }
            } else {
                setIsGenerated(false);
                setSelectedYears([1]);
                const needed = (sData || [])
                    .filter(s => Number(s.academic_year) === 1)
                    .reduce((sum, s) => sum + parseInt(s.total_students || 0, 10), 0);
                setSelectedRooms(autoSelectRoomsForStudents(needed, roomList));
            }
        } catch (err) {
            console.error("Failed to load slot state", err);
            setIsGenerated(false);
        }
    }, [rooms, studentData, autoSelectRoomsForStudents]);

    useEffect(() => {
        const init = async () => {
            try {
                const res = await axios.get('http://localhost:5000/api/allocation/init');
                const roomList = res.data.rooms || [];
                const sData = res.data.students || res.data.studentData || [];
                setRooms(roomList);
                setStudentData(sData);

                let validScheduledDates = res.data.scheduledDates || [];
                if (!validScheduledDates.length) {
                    try {
                        const dateRes = await axios.get('http://localhost:5000/api/exam-dates-only');
                        validScheduledDates = (dateRes.data || [])
                            .map(d => getYYYYMMDD(new Date(d.exam_date)))
                            .filter(Boolean);
                    } catch (e) {}
                }
                setScheduledDates(validScheduledDates);

                if (validScheduledDates.length > 0) {
                    const initialDate = validScheduledDates[0];
                    setExamDate(initialDate);
                    setViewDate(new Date(initialDate));
                    setSession("FN");

                    // Load saved state immediately so isGenerated is accurate on page load
                    await loadSavedSlotState(initialDate, "FN", roomList, sData);
                }
            } catch (err) {
                console.error("Initialization failed", err);
            }
        };
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-sync saved allocation state whenever slot (date / session) changes
    useEffect(() => {
        if (examDate && session && rooms.length > 0) {
            loadSavedSlotState(examDate, session);
        }
    }, [examDate, session, loadSavedSlotState, rooms.length]);

    const handleExamDateChange = (newDate) => {
        setExamDate(newDate);
        if (newDate) {
            loadSavedSlotState(newDate, session);
        }
    };

    const handleSessionChange = (newSession) => {
        setSession(newSession);
        if (examDate) {
            loadSavedSlotState(examDate, newSession);
        }
    };

    const toggleYear = (year) => {
        const yearNum = Number(year);
        const updatedYears = selectedYears.includes(yearNum) 
            ? selectedYears.filter(y => y !== yearNum) 
            : [...selectedYears, yearNum];
        
        setSelectedYears(updatedYears);

        // Auto-select rooms required for the updated student count
        const neededStudents = (studentData || [])
            .filter(s => updatedYears.includes(Number(s.academic_year)))
            .reduce((sum, s) => sum + parseInt(s.total_students || 0, 10), 0);
        
        if (neededStudents > 0) {
            const autoRooms = autoSelectRoomsForStudents(neededStudents, rooms);
            setSelectedRooms(autoRooms);
        } else {
            setSelectedRooms([]);
        }
    };

    const handleAutoSelect = () => {
        if (totalStudents <= 0) {
            alert("Please select at least one academic year with students.");
            return;
        }
        const autoRooms = autoSelectRoomsForStudents(totalStudents, rooms);
        setSelectedRooms(autoRooms);
    };

    const toggleRoom = (roomId) => {
        setSelectedRooms(prev => 
            prev.includes(roomId) ? prev.filter(id => id !== roomId) : [...prev, roomId]
        );
    };

    const filteredRooms = (rooms || []).filter(r => 
        `${r.block}${r.room_no}`.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelectAll = () => {
        const filteredIds = filteredRooms.map(r => `${r.block}${r.room_no}`);
        const allSelected = filteredIds.every(id => selectedRooms.includes(id));
        
        if (allSelected) {
            setSelectedRooms(prev => prev.filter(id => !filteredIds.includes(id)));
        } else {
            setSelectedRooms(prev => [...new Set([...prev, ...filteredIds])]);
        }
    };

    const totalStudents = (studentData || [])
        .filter(s => selectedYears.includes(Number(s.academic_year)))
        .reduce((sum, s) => sum + parseInt(s.total_students || 0, 10), 0);

    const totalCapacity = (rooms || [])
        .filter(r => selectedRooms.includes(`${r.block}${r.room_no}`))
        .reduce((sum, r) => sum + parseInt(r.capacity || 0, 10), 0);

    const handleSaveSelection = async () => {
        if (!examDate) {
            alert("Please select a scheduled exam date from the calendar first.");
            return;
        }
        const payload = { examDate, session, selectedYears, selectedRooms };
        try {
            await axios.post('http://localhost:5000/api/allocation/save', payload);
            alert("Selection saved successfully!");
        } catch (err) {
            alert("Failed to save selection.");
        }
    };

    const handleGenerateAllocation = async () => {
        if (!examDate || selectedYears.length === 0 || selectedRooms.length === 0) {
            alert("Please ensure Exam Date, Years, and Rooms are all selected.");
            return;
        }

        const payload = { examDate, session, selectedYears, selectedRooms };

        setIsAllocating(true);
        setAllocationSuccess(false);
        setAllocationProgress(15);
        setAllocationPhase("Analyzing hall capacities & student distribution...");

        const t1 = setTimeout(() => {
            setAllocationProgress(45);
            setAllocationPhase("Balancing column benches and interleaving branches...");
        }, 400);

        const t2 = setTimeout(() => {
            setAllocationProgress(80);
            setAllocationPhase("Committing seating assignments to database...");
        }, 800);

        try {
            const response = await axios.post('http://localhost:5000/api/allocation/generate', payload);
            clearTimeout(t1);
            clearTimeout(t2);
            setAllocationProgress(100);
            setAllocationSuccess(true);
            setIsGenerated(true);
            const reportMessage = response.data.reportName
                ? ` Report saved as ${response.data.reportName}.`
                : "";
            setAllocationPhase((response.data.message || "Seating allocation generated successfully!") + reportMessage);

            // Auto-close after 2.5 seconds without separate alert popup
            setTimeout(() => {
                setIsAllocating(false);
                setAllocationSuccess(false);
                loadSavedSlotState(examDate, session);
            }, 2500);
        } catch (err) {
            clearTimeout(t1);
            clearTimeout(t2);
            setIsAllocating(false);
            setAllocationSuccess(false);
            console.error("Generation Error:", err);
            const errorMsg = err.response?.data?.message || "Failed to generate allocation.";
            alert(errorMsg);
        }
    };

    const handleDeleteAllocation = async () => {
        if (!examDate) {
            alert("Please select an exam date to delete seating allocation.");
            return;
        }
        if (!window.confirm(`Are you sure you want to delete seating allocation for ${examDate} (${session})?`)) {
            return;
        }

        try {
            await axios.delete('http://localhost:5000/api/allocation/delete', {
                data: { date: examDate, session }
            });
            setIsGenerated(false);
            setIsAllocating(true);
            setAllocationProgress(100);
            setAllocationSuccess(true);
            setAllocationPhase(`Seating allocation removed for ${examDate} (${session}).`);

            setTimeout(() => {
                setIsAllocating(false);
                setAllocationSuccess(false);
                loadSavedSlotState(examDate, session);
            }, 1800);
        } catch (err) {
            console.error("Delete Error:", err);
            alert(err.response?.data?.message || "Failed to delete seating allocation.");
        }
    };

    const renderCalendar = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days = [];
        
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="cal-day empty"></div>);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = getYYYYMMDD(new Date(year, month, d));
            const isExam = scheduledDates.includes(dateStr);
            const isSelected = examDate === dateStr;
            
            days.push(
                <div 
                    key={d} 
                    className={`cal-day ${isExam ? 'exam-day' : 'disabled-day'} ${isSelected ? 'active-day' : ''}`} 
                    onClick={() => {
                        if (isExam) {
                            handleExamDateChange(dateStr);
                        }
                    }}
                    title={isExam ? `Scheduled Exam: ${dateStr}` : "No exams scheduled on this date"}
                >
                    {d}
                </div>
            );
        }
        return days;
    };

    return (
        <div className="dashboard-container">
            <AdminSidebar />
            <main className="main-content">
                <div className="manage-card">
                    <h2 className="card-title">Generate Seating Allocation</h2>
                    
                    {/* Top Section: Calendar Widget + Slot Controls */}
                    <div className="seating-top-grid">
                        {/* Calendar Widget */}
                        <div className="cal-widget">
                            <div className="cal-nav">
                                <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}>
                                    <FaChevronLeft />
                                </button>
                                <span>{viewDate.toLocaleString('default', { month: 'short', year: 'numeric' })}</span>
                                <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}>
                                    <FaChevronRight />
                                </button>
                            </div>
                            <div className="cal-week">
                                {['S','M','T','W','T','F','S'].map((d, i) => <div key={i}>{d}</div>)}
                            </div>
                            <div className="cal-grid">{renderCalendar()}</div>
                            <div className="cal-legend">
                                <span className="legend-item"><span className="legend-dot exam"></span> Scheduled Date</span>
                                <span className="legend-item"><span className="legend-dot selected"></span> Selected</span>
                            </div>
                        </div>

                        {/* Slot Controls */}
                        <div className="slot-controls-card">
                            <div className="slot-control-row">
                                <div className="slot-field">
                                    <label className="slot-label">Selected Exam Date</label>
                                    <div className="active-date-badge">
                                        <strong>{examDate || "Select a highlighted date"}</strong>
                                    </div>
                                </div>
                                <div className="slot-field">
                                    <label className="slot-label">Session</label>
                                    <div className="session-toggle-group">
                                        <button 
                                            type="button"
                                            className={`session-btn ${session === 'FN' ? 'active' : ''}`}
                                            onClick={() => handleSessionChange('FN')}
                                        >
                                            FN (Morning)
                                        </button>
                                        <button 
                                            type="button"
                                            className={`session-btn ${session === 'AN' ? 'active' : ''}`}
                                            onClick={() => handleSessionChange('AN')}
                                        >
                                            AN (Afternoon)
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="slot-field" style={{ marginTop: '12px' }}>
                                <label className="slot-label">Select Academic Years</label>
                                <div className="year-btn-group">
                                    {[1, 2, 3, 4].map(y => {
                                        const yearData = (studentData || []).find(s => Number(s.academic_year) === y);
                                        const count = yearData ? yearData.total_students : 0;
                                        return (
                                            <button 
                                                key={y} 
                                                type="button"
                                                className={`year-btn ${selectedYears.includes(y) ? 'active' : ''}`}
                                                onClick={() => toggleYear(y)}
                                            >
                                                <span className="year-num">Year {y}</span>
                                                <span className="year-count">({count} students)</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="allocation-container">
                        <div className="rooms-selection-card">
                            {/* Header with Auto-fit and Select All */}
                            <div className="selection-header">
                                <div className="header-left">
                                    <h4>Select Exam Halls</h4>
                                    <span className="room-count-badge">{selectedRooms.length} Selected</span>
                                </div>
                                <div className="header-actions">
                                    <button 
                                        type="button"
                                        className="auto-fit-btn" 
                                        onClick={handleAutoSelect}
                                        title="Auto-select rooms required for student capacity"
                                    >
                                        <FaBolt /> Auto Fit ({totalStudents} Seats)
                                    </button>
                                    <button 
                                        type="button"
                                        className="select-all-btn" 
                                        onClick={handleSelectAll}
                                    >
                                        {filteredRooms.length > 0 && filteredRooms.every(r => selectedRooms.includes(`${r.block}${r.room_no}`)) ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>
                            </div>

                            <input 
                                className="search-bar" 
                                placeholder="Search room by block or number..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)} 
                            />
                            <div className="scrollable-rooms">
                                {filteredRooms.map(room => {
                                    const id = `${room.block}${room.room_no}`;
                                    const isChecked = selectedRooms.includes(id);
                                    return (
                                        <div className={`room-item ${isChecked ? 'selected-row' : ''}`} key={id}>
                                            <div className="room-info">
                                                <span className="room-id">{id}</span>
                                                <span className="room-cap">Capacity: {room.capacity}</span>
                                            </div>
                                            <label className="switch">
                                                <input 
                                                    type="checkbox" 
                                                    checked={isChecked}
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
                                    <p>Total Students to Allocate</p>
                                    <h2>{totalStudents}</h2> 
                                </div>
                                <div className="stat-card">
                                    <p>Total Capacity of Selected Halls</p>
                                    <h2 className={totalCapacity >= totalStudents && totalStudents > 0 ? "cap-success" : ""}>
                                        {totalCapacity}
                                    </h2>
                                </div>
                                
                                {totalStudents > totalCapacity && (
                                    <div className="capacity-warning">
                                        ⚠️ Shortage: Need {totalStudents - totalCapacity} more seats!
                                    </div>
                                )}

                                {totalCapacity >= totalStudents && totalStudents > 0 && (
                                    <div className="capacity-ok">
                                        ✓ Sufficient capacity selected
                                    </div>
                                )}
                            </div>
                            
                            <div className="totals-actions">
                                <button type="button" className="action-btn-secondary" onClick={handleSaveSelection}>
                                    Save Selection
                                </button>
                                {isGenerated ? (
                                    <div className="seating-generated-btn-group">
                                        <button 
                                            type="button"
                                            className="action-btn-primary regen" 
                                            onClick={handleGenerateAllocation}
                                            disabled={totalStudents === 0 || totalStudents > totalCapacity}
                                            title="Regenerate seating allocation for this slot"
                                        >
                                            Regenerate Seating
                                        </button>
                                        <button
                                            type="button"
                                            className="delete-icon-btn action-delete-seating"
                                            onClick={handleDeleteAllocation}
                                            title="Delete Seating Allocation for this slot"
                                        >
                                            <FaTrash />
                                        </button>
                                    </div>
                                ) : (
                                    <button 
                                        type="button"
                                        className="action-btn-primary" 
                                        onClick={handleGenerateAllocation}
                                        disabled={totalStudents === 0 || totalStudents > totalCapacity}
                                    >
                                        Generate Allocation
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Modern Glassmorphic Loading Modal */}
            {isAllocating && (
                <div className="modern-loading-overlay">
                    <div className={`modern-loading-card ${allocationSuccess ? "success-state" : ""}`}>
                        <div className={`loader-glow-ring ${allocationSuccess ? "success-ring" : ""}`}>
                            {allocationSuccess ? (
                                <FaCheckCircle className="done-icon" />
                            ) : (
                                <FaSpinner className="spinning-icon" />
                            )}
                        </div>
                        <h3 className="loading-card-title">
                            {allocationSuccess ? "Done! Allocation Ready" : (isGenerated ? "Regenerating Seating" : "Generating Seating Allocation")}
                        </h3>
                        <p className="loading-card-phase">{allocationPhase}</p>
                        
                        <div className="modern-progress-track">
                            <div 
                                className={`modern-progress-fill ${allocationSuccess ? "success-fill" : ""}`} 
                                style={{ width: `${allocationProgress}%` }}
                            >
                                <div className="shimmer-effect"></div>
                            </div>
                        </div>
                        
                        <div className="loading-card-footer">
                            <span>{allocationSuccess ? "Complete ✓" : `${allocationProgress}% Complete`}</span>
                            <span>Slot: {examDate} ({session})</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Allocation;
