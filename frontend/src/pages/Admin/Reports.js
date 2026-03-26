import React, { useEffect, useState } from "react";
import axios from "axios";
import "./report.css";
import AdminSidebar from "./AdminSidebar";

function Reports() {
    const [examDate, setExamDate] = useState("");
    const [reportType, setReportType] = useState("");
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchReports = async (filters = {}) => {
        setLoading(true);
        try {
            const res = await axios.get("http://localhost:5000/api/reports", {
                params: filters
            });
            setReports(res.data || []);
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

        if (examDate) {
            filters.examDate = examDate;
        }

        if (reportType) {
            filters.reportType = reportType;
        }

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
                `http://localhost:5000/api/reports/${reportId}/download`,
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
                                <option value="Duty Allocated">Duty Allocated</option>
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
                    <h3>Report History</h3>

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
                                        <th>Report ID</th>
                                        <th>Report Name</th>
                                        <th>Exam Date</th>
                                        <th>Type</th>
                                        <th>Generated At</th>
                                        <th>Filepath</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {reports.map((report) => (
                                        <tr key={report.report_id}>
                                            <td>{report.report_id}</td>
                                            <td>{report.report_name}</td>
                                            <td>{new Date(report.exam_date).toLocaleDateString("en-CA")}</td>
                                            <td>{report.report_type}</td>
                                            <td>{new Date(report.generated_at).toLocaleString()}</td>
                                            <td>
                                                <button
                                                    className="download-btn"
                                                    onClick={() => handleDownload(report.report_id, report.report_name)}
                                                >
                                                    Download
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
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
