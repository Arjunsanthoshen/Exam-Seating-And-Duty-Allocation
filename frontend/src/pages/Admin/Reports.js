import React, { useEffect, useState } from "react";
import axios from "axios";
import "./report.css";
import AdminSidebar from "./AdminSidebar";
import { API_BASE_URL } from "../../api/config";
import { FaTrash, FaDownload } from "react-icons/fa";

function Reports() {
    const [examDate, setExamDate] = useState("");
    const [reportType, setReportType] = useState("");
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedReportIds, setSelectedReportIds] = useState([]);

    const fetchReports = async (filters = {}) => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/api/reports`, {
                params: filters
            });
            setReports(res.data || []);
            setSelectedReportIds([]);
        } catch (error) {
            console.error("Failed to fetch reports", error);
            alert("Failed to fetch reports");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    const handleApplyFilters = () => {
        const filters = {};
        if (examDate) filters.examDate = examDate;
        if (reportType) filters.reportType = reportType;
        fetchReports(filters);
    };

    const handleClearFilters = () => {
        setExamDate("");
        setReportType("");
        fetchReports();
    };

    const handleDownload = async (reportId, reportName) => {
        try {
            const response = await axios.get(
                `${API_BASE_URL}/api/reports/${reportId}/download`,
                { responseType: "blob" }
            );

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;
            link.download = `${reportName}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to download report", error);
            alert("Failed to download report");
        }
    };

    const handleToggleSelect = (id) => {
        setSelectedReportIds(prev => 
            prev.includes(id) ? prev.filter(rId => rId !== id) : [...prev, id]
        );
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedReportIds(reports.map(r => r.report_id));
        } else {
            setSelectedReportIds([]);
        }
    };

    const isDemoUser = localStorage.getItem("isDemo") === "true" || (localStorage.getItem("username") || "").toLowerCase() === "demo";

    const handleDeleteSelected = async () => {
        if (!selectedReportIds.length) return;
        if (isDemoUser) {
            const hasProhibited = selectedReportIds.some(id => {
                const r = reports.find(item => item.report_id === id);
                return !r || !r.is_demo;
            });
            if (hasProhibited) {
                alert("Demo users cannot delete this data.");
                return;
            }
        }

        if (!window.confirm(`Are you sure you want to permanently delete ${selectedReportIds.length} selected report(s)?`)) {
            return;
        }

        try {
            const res = await axios.delete(`${API_BASE_URL}/api/reports/bulk`, {
                data: { reportIds: selectedReportIds }
            });
            alert(res.data?.message || `Successfully deleted ${selectedReportIds.length} report(s).`);
            fetchReports();
        } catch (error) {
            console.error("Failed to delete reports", error);
            alert(error.response?.data?.message || "Failed to delete reports");
        }
    };

    const handleDeleteSingle = async (reportId) => {
        const reportObj = reports.find(r => r.report_id === reportId);
        if (isDemoUser && (!reportObj || !reportObj.is_demo)) {
            alert("Demo users cannot delete this data.");
            return;
        }

        if (!window.confirm("Are you sure you want to permanently delete this report?")) {
            return;
        }

        try {
            await axios.delete(`${API_BASE_URL}/api/reports/${reportId}`);
            fetchReports();
        } catch (error) {
            console.error("Failed to delete report", error);
            alert(error.response?.data?.message || "Failed to delete report");
        }
    };

    const allSelected = reports.length > 0 && selectedReportIds.length === reports.length;

    return (
        <div className="reports-layout">
            <AdminSidebar />

            <div className="reports-page">
                <h2 className="reports-title">Reports (Admin Portal)</h2>

                <div className="generate-report-box">
                    <h3>Filter Reports By</h3>

                    <div className="generate-fields">
                        <div className="field">
                            <label>Select Exam Date</label>
                            <input
                                type="date"
                                value={examDate}
                                onChange={(e) => setExamDate(e.target.value)}
                            />
                        </div>

                        <div className="field">
                            <label>Select Report Type</label>
                            <select
                                value={reportType}
                                onChange={(e) => setReportType(e.target.value)}
                            >
                                <option value="">All Report Types</option>
                                <option value="Hall-wise">Hall-wise</option>
                                <option value="Invigilation Duty">Invigilation Duty</option>
                                <option value="Total Seating">Total Seating</option>
                            </select>
                        </div>
                    </div>

                    <div className="report-filter-actions">
                        <button className="generate-btn" onClick={handleApplyFilters}>
                            Apply Filters
                        </button>
                        <button className="secondary-btn" onClick={handleClearFilters}>
                            Clear Filters
                        </button>
                    </div>
                </div>

                <div className="report-history">
                    <div className="report-history-header">
                        <div className="history-title-group">
                            <h3>Report History</h3>
                            <span className="history-count">({reports.length} total)</span>
                        </div>
                        <div className="history-actions">
                            <button
                                className="delete-selected-btn"
                                onClick={handleDeleteSelected}
                                disabled={selectedReportIds.length === 0}
                                title={selectedReportIds.length === 0 ? "Select reports to delete" : "Delete all selected reports"}
                            >
                                <FaTrash style={{ marginRight: "6px" }} />
                                Delete Selected ({selectedReportIds.length})
                            </button>
                        </div>
                    </div>

                    <div className="report-history-scroll">
                        {loading ? (
                            <div className="empty-history">
                                <p>Loading reports...</p>
                            </div>
                        ) : reports.length === 0 ? (
                            <div className="empty-history">
                                <p>No reports found.</p>
                                <span>Generated allocation reports will appear here.</span>
                            </div>
                        ) : (
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ width: "40px", textAlign: "center" }}>
                                            <input
                                                type="checkbox"
                                                className="report-checkbox"
                                                checked={allSelected}
                                                onChange={handleSelectAll}
                                                title="Select all reports"
                                            />
                                        </th>
                                        <th>Report ID</th>
                                        <th>Report Name</th>
                                        <th>Exam Date</th>
                                        <th>Type</th>
                                        <th>Generated At</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {reports.map((report) => {
                                        const isChecked = selectedReportIds.includes(report.report_id);
                                        return (
                                            <tr key={report.report_id} className={isChecked ? "selected-report-row" : ""}>
                                                <td style={{ textAlign: "center" }}>
                                                    <input
                                                        type="checkbox"
                                                        className="report-checkbox"
                                                        checked={isChecked}
                                                        onChange={() => handleToggleSelect(report.report_id)}
                                                    />
                                                </td>
                                                <td style={{ fontWeight: "700", color: "#f8fafc" }}>{report.report_name}</td>
                                                <td>{new Date(report.exam_date).toLocaleDateString("en-CA")}</td>
                                                <td>
                                                    <span className={`report-type-pill ${
                                                        (report.report_type || "").toLowerCase().includes("hall")
                                                            ? "type-hall"
                                                            : (report.report_type || "").toLowerCase().includes("total") || (report.report_type || "").toLowerCase().includes("seating")
                                                            ? "type-seating"
                                                            : (report.report_type || "").toLowerCase().includes("duty") || (report.report_type || "").toLowerCase().includes("invigilation")
                                                            ? "type-duty"
                                                            : "type-default"
                                                    }`}>
                                                        {report.report_type}
                                                    </span>
                                                </td>
                                                <td>{new Date(report.generated_at).toLocaleString()}</td>
                                                <td>
                                                    <div className="report-row-actions">
                                                        <button
                                                            className="download-btn"
                                                            onClick={() => handleDownload(report.report_id, report.report_name)}
                                                            title="Download PDF"
                                                        >
                                                            <FaDownload style={{ marginRight: "4px" }} /> Download
                                                        </button>
                                                        <button
                                                            className="delete-single-btn"
                                                            onClick={() => handleDeleteSingle(report.report_id)}
                                                            title="Delete this report"
                                                        >
                                                            <FaTrash />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Reports;
