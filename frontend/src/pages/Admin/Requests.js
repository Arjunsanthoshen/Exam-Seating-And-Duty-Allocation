import React, { useEffect, useState } from "react";
import axios from "axios";
import AdminSidebar from "./AdminSidebar";
import { 
  FaCheck, FaTimes, FaInbox, FaUserTie, 
  FaCalendarAlt, FaClock, FaCommentAlt 
} from "react-icons/fa";
import "./Requests.css";

const formatDate = (dateValue) => {
  if (!dateValue) return "-";
  return new Date(dateValue).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};

const Requests = () => {
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        setErrorMessage("");

        const requestsResponse = await axios.get("http://localhost:5000/api/admin/requests");

        const fetchedRequests = Array.isArray(requestsResponse.data) ? requestsResponse.data : [];
        setRequests(fetchedRequests);
        setSelectedRequest(fetchedRequests[0] || null);

        axios.post("http://localhost:5000/api/admin/requests/mark-read")
          .catch((error) => {
            console.error("Failed to mark requests as read", error);
          });
      } catch (error) {
        console.error("Failed to fetch requests", error);
        setErrorMessage(error.response?.data?.message || "Failed to fetch requests.");
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, []);

  const handleDecision = async (request, decision) => {
    try {
      setProcessingId(request.unavailability_id);
      const response = await axios.post(
        `http://localhost:5000/api/admin/requests/${request.unavailability_id}/decision`,
        { decision }
      );

      const removedRequestId = response.data.removedRequestId;

      setRequests((current) => {
        const updatedRequests = current.filter((item) => item.unavailability_id !== removedRequestId);

        setSelectedRequest((currentSelected) => {
          if (!currentSelected || currentSelected.unavailability_id !== removedRequestId) {
            return currentSelected;
          }

          return updatedRequests[0] || null;
        });

        return updatedRequests;
      });
    } catch (error) {
      window.alert(error.response?.data?.message || "Failed to update teacher availability.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="admin-page-container">
      <AdminSidebar />

      <main className="admin-main-viewport">
        {/* Header */}
        <header className="admin-header-glass">
          <div className="admin-header-left">
            <div className="admin-context-pill">
              <FaInbox /> FACULTY EXEMPTIONS
            </div>
            <h1>Faculty Duty Exemption Requests</h1>
            <p className="admin-header-sub">
              Review and approve or decline faculty unavailability submissions prior to duty allocation.
            </p>
          </div>

          <div className="teacher-header-stats">
            <div className="stat-pill-item unavailable">
              <span className="stat-num">{requests.length}</span>
              <span className="stat-label">Pending Requests</span>
            </div>
          </div>
        </header>

        {/* 2-Column Split: Requests List + Detailed Review Pane */}
        <div className="requests-split-grid">
          {/* List of Requests */}
          <section className="admin-glass-panel">
            <div className="admin-panel-head">
              <div className="panel-title-group">
                <h2>Pending Submissions</h2>
                <p>{requests.length} faculty requests awaiting administrative decision</p>
              </div>
            </div>

            {loading ? (
              <div className="requests-state-box">
                <div className="admin-table-spinner"></div>
                <p>Loading exemption requests...</p>
              </div>
            ) : errorMessage ? (
              <div className="requests-state-box error">
                <p>{errorMessage}</p>
                <button type="button" className="admin-refresh-btn" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </div>
            ) : requests.length === 0 ? (
              <div className="requests-state-box">
                <FaCheck className="done-icon" />
                <h3>All Requests Reviewed</h3>
                <p>No pending faculty unavailability submissions found.</p>
              </div>
            ) : (
              <div className="requests-cards-stack">
                {requests.map((request) => {
                  const isSelected = selectedRequest?.unavailability_id === request.unavailability_id;
                  const isBusy = processingId === request.unavailability_id;

                  return (
                    <div
                      key={request.unavailability_id}
                      className={`request-card-tile ${isSelected ? "active" : ""}`}
                      onClick={() => setSelectedRequest(request)}
                    >
                      <div className="tile-top-line">
                        <div className="tile-faculty-info">
                          <FaUserTie className="tile-icon" />
                          <div>
                            <strong>{request.teacher_name || request.Tusername}</strong>
                            <span className="tile-email">{request.Tusername}</span>
                          </div>
                        </div>

                        <div className="tile-action-btns" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="tile-action-btn accept"
                            onClick={() => handleDecision(request, "accept")}
                            disabled={isBusy}
                            title="Approve exemption (sets teacher to Unavailable)"
                          >
                            <FaCheck />
                          </button>
                          <button
                            type="button"
                            className="tile-action-btn reject"
                            onClick={() => handleDecision(request, "reject")}
                            disabled={isBusy}
                            title="Decline exemption"
                          >
                            <FaTimes />
                          </button>
                        </div>
                      </div>

                      <div className="tile-meta-line">
                        <span className="tile-chip">
                          <FaCalendarAlt /> {formatDate(request.exam_date)}
                        </span>
                        <span className="tile-chip session">
                          <FaClock /> Session: {request.session}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Details Pane */}
          <aside className="admin-glass-panel">
            <div className="admin-panel-head">
              <div className="panel-title-group">
                <h2>Submission Review</h2>
                <p>Full faculty justification and slot details</p>
              </div>
            </div>

            {selectedRequest ? (
              <div className="request-full-details-view">
                <div className="review-avatar-banner">
                  <div className="review-avatar-circle">
                    {(selectedRequest.teacher_name || "T").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="review-name">{selectedRequest.teacher_name || "Faculty Member"}</h3>
                    <span className="review-email">{selectedRequest.Tusername}</span>
                  </div>
                </div>

                <div className="review-fields-grid">
                  <div className="review-field-card">
                    <span className="field-card-label">EXAM DATE</span>
                    <strong className="field-card-value">
                      <FaCalendarAlt className="field-icon blue" /> {formatDate(selectedRequest.exam_date)}
                    </strong>
                  </div>

                  <div className="review-field-card">
                    <span className="field-card-label">SESSION</span>
                    <strong className="field-card-value">
                      <FaClock className="field-icon blue" /> {selectedRequest.session}
                    </strong>
                  </div>

                  <div className="review-field-card full-w">
                    <span className="field-card-label">JUSTIFICATION & REASON</span>
                    <div className="review-reason-quote">
                      <FaCommentAlt className="quote-icon" />
                      <p>{selectedRequest.reason}</p>
                    </div>
                  </div>
                </div>

                <div className="review-action-footer">
                  <button
                    type="button"
                    className="admin-quick-btn secondary full-w"
                    onClick={() => handleDecision(selectedRequest, "reject")}
                    disabled={processingId === selectedRequest.unavailability_id}
                  >
                    <FaTimes /> Decline Request
                  </button>
                  <button
                    type="button"
                    className="admin-quick-btn primary full-w"
                    onClick={() => handleDecision(selectedRequest, "accept")}
                    disabled={processingId === selectedRequest.unavailability_id}
                  >
                    <FaCheck /> Approve Exemption
                  </button>
                </div>
              </div>
            ) : (
              <div className="requests-state-box">
                <p>Select a request from the list to inspect details.</p>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
};

export default Requests;
