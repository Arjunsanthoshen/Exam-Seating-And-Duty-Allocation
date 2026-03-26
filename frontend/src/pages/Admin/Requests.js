import React, { useEffect, useState } from "react";
import axios from "axios";
import AdminSidebar from "./AdminSidebar";
import { FaCheck, FaTimes } from "react-icons/fa";
import "./Requests.css";

const formatDate = (dateValue) => {
  if (!dateValue) return "-";
  return new Date(dateValue).toLocaleDateString("en-US", {
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

        const fetchedRequests = requestsResponse.data || [];
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
    <div className="requests-layout">
      <AdminSidebar />

      <main className="requests-page">
        <div className="requests-header-card">
          <h2>Teacher Requests</h2>
          <p>Teachers who marked themselves unavailable are listed here.</p>
        </div>

        <div className="requests-content">
          <section className="requests-list-card">
            <div className="requests-card-header">
              <h3>Received Requests</h3>
              <span>{requests.length} total</span>
            </div>

            {loading ? (
              <div className="requests-empty">Loading requests...</div>
            ) : errorMessage ? (
              <div className="requests-empty requests-error">
                <p>{errorMessage}</p>
                <button
                  type="button"
                  className="requests-retry-btn"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </button>
              </div>
            ) : requests.length === 0 ? (
              <div className="requests-empty">No unavailability requests found.</div>
            ) : (
              <div className="request-name-list">
                {requests.map((request) => (
                  <div
                    key={request.unavailability_id}
                    className={`request-list-item ${selectedRequest?.unavailability_id === request.unavailability_id ? "selected" : ""}`}
                  >
                    <button
                      type="button"
                      className="request-name-trigger"
                      onClick={() => setSelectedRequest(request)}
                    >
                      <span className="request-list-name">{request.teacher_name || request.Tusername}</span>
                    </button>
                    <div className="request-action-group">
                      <button
                        type="button"
                        className="request-action-btn accept"
                        onClick={() => handleDecision(request, "accept")}
                        disabled={processingId === request.unavailability_id}
                        title="Accept request"
                      >
                        <FaCheck />
                      </button>
                      <button
                        type="button"
                        className="request-action-btn reject"
                        onClick={() => handleDecision(request, "reject")}
                        disabled={processingId === request.unavailability_id}
                        title="Reject request"
                      >
                        <FaTimes />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="request-detail-card">
            <div className="requests-card-header">
              <h3>Request Details</h3>
            </div>

            {selectedRequest ? (
              <div className="request-detail-grid">
                <div className="request-detail-item">
                  <span>unavailability_id</span>
                  <strong>{selectedRequest.unavailability_id}</strong>
                </div>
                <div className="request-detail-item">
                  <span>Tusername</span>
                  <strong>{selectedRequest.Tusername}</strong>
                </div>
                <div className="request-detail-item">
                  <span>Teacher Name</span>
                  <strong>{selectedRequest.teacher_name || "-"}</strong>
                </div>
                <div className="request-detail-item">
                  <span>availability</span>
                  <strong>{selectedRequest.availability || "-"}</strong>
                </div>
                <div className="request-detail-item">
                  <span>exam_date</span>
                  <strong>{formatDate(selectedRequest.exam_date)}</strong>
                </div>
                <div className="request-detail-item">
                  <span>session</span>
                  <strong>{selectedRequest.session}</strong>
                </div>
                <div className="request-detail-item request-detail-reason">
                  <span>reason</span>
                  <strong>{selectedRequest.reason}</strong>
                </div>
              </div>
            ) : (
              <div className="requests-empty">Select a teacher name to view request details.</div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
};

export default Requests;
