// frontend/src/components/AdminAudits.jsx
import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ToggleLeft, ToggleRight, CheckSquare, AlertCircle, Clock, CheckCircle2, Calendar } from 'lucide-react';
import api from '../utils/api';
import { getMockAudits } from '../utils/adminMockData';
import './styles/AdminDashboard.css';

const AdminAudits = () => {
  // Pull the global timezone state synchronized via the layout outlet context
  const { userTimezone, filterDate, setFilterDate } = useOutletContext() || {
     userTimezone: 'UTC', 
     filterDate: '', 
     setFilterDate: () => {} 
    };

  const [loading, setLoading] = useState(true);
  const [audits, setAudits] = useState([]);
  const [monthlyPrecision, setMonthlyPrecision] = useState(100.0);
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [editExplanation, setEditExplanation] = useState('');
  const [reviewedToggle, setReviewedToggle] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [usingMock, setUsingMock] = useState(false);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'reviewed'

  useEffect(() => {
    const fetchAudits = async () => {
      try {
        setLoading(true);
        // Direct integration passing the timezone context parameter
        let url = `/api/admin/audits?tz=${encodeURIComponent(userTimezone)}`;
        if(filterDate && filterDate !== 'All') {
          url += `&filter_date=${encodeURIComponent(filterDate)}`;
        }

        const response = await api.get(url);
        
        if (response.data && response.data.success) {
          setAudits(response.data.audits);
          // Extract the real-time calculated monthly metric from the server metrics telemetry context
          if (response.data.monthly_accuracy_score !== undefined) {
            setMonthlyPrecision(response.data.monthly_accuracy_score);
          }
          setUsingMock(false);
          
          if (response.data.audits.length > 0) {
            // Respect the default tab filter logic on initialization safely
            const initialPending = response.data.audits.filter(a => !a.reviewed_by_admin);
            if (initialPending.length > 0) {
              selectAuditItem(initialPending[0]);
            } else if (response.data.audits.length > 0) {
              selectAuditItem(response.data.audits[0]);
              setActiveTab('reviewed');
            }
          } else {
            setSelectedAudit(null);
          }
        } else {
          throw new Error("Invalid response format");
        }
      } catch (err) {
        console.warn("Audits API endpoint not active yet. Loading interactive frontend mock auditing workspace.");
        const mockData = getMockAudits();
        setAudits(mockData);
        setMonthlyPrecision(88.4); // Local baseline fallback
        setUsingMock(true);
        
        const initialPending = mockData.filter(a => !a.reviewed_by_admin);
        if (initialPending.length > 0) {
          selectAuditItem(initialPending[0]);
        } else if (mockData.length > 0) {
          selectAuditItem(mockData[0]);
          setActiveTab('reviewed');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAudits();
  }, [userTimezone, filterDate]);

  const selectAuditItem = (audit) => {
    if (!audit) {
      setSelectedAudit(null);
      setEditExplanation('');
      setReviewedToggle(false);
      return;
    }
    setSelectedAudit(audit);
    setEditExplanation(audit.auto_generated_explanation || '');
    setReviewedToggle(audit.reviewed_by_admin || false);
    setStatusMsg({ type: '', text: '' });
  };

  const handleConfirmResolution = async (e) => {
    e.preventDefault();
    if (!selectedAudit) return;

    setIsSaving(true);
    setStatusMsg({ type: '', text: '' });

    const payload = {
      reviewed_by_admin: reviewedToggle,
      auto_generated_explanation: editExplanation
    };

    try {
      const response = await api.put(`/api/admin/audits/${selectedAudit.id}`, payload);
      if (response.data && response.data.success) {
        setStatusMsg({ type: 'success', text: 'Audit resolution saved successfully to SQLite DB!' });
        
        setAudits(prev => prev.map(a => 
          a.id === selectedAudit.id 
            ? { ...a, reviewed_by_admin: reviewedToggle, auto_generated_explanation: editExplanation }
            : a
        ));
        
        setSelectedAudit(prev => ({
          ...prev,
          reviewed_by_admin: reviewedToggle,
          auto_generated_explanation: editExplanation
        }));
      } else {
        throw new Error("API resolution failure");
      }
    } catch (err) {
      console.warn("Backend Put API not active yet. Saving audit resolution to local state database.");
      
      setAudits(prev => prev.map(a => 
        a.id === selectedAudit.id 
          ? { ...a, reviewed_by_admin: reviewedToggle, auto_generated_explanation: editExplanation }
          : a
      ));

      setSelectedAudit(prev => ({
        ...prev,
        reviewed_by_admin: reviewedToggle,
        auto_generated_explanation: editExplanation
      }));

      setStatusMsg({ 
        type: 'success', 
        text: 'Demonstration Mode: Audit saved locally! (reviewed_by_admin = ' + (reviewedToggle ? 'true' : 'false') + ')' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-loading-screen">
        <div className="spinner"></div>
        <p className="loading-text">Loading admin auditing table and workspace...</p>
      </div>
    );
  }

  // 1. Dynamic extraction of unique operational dates in user context for the calendar dropdown
  const uniqueDays = Array.from(
    new Set(audits.map(item => item.formatted_date || (item.captured_at ? item.captured_at.split('T')[0] : null)))
  ).filter(Boolean).sort().reverse();

  // 2. Linear filter combination evaluation line
  const filteredAudits = audits.filter(item => {
    if (!filterDate || filterDate === 'All') return true;
    const itemDay = item.formatted_date || (item.captured_at ? item.captured_at.split('T')[0] : '');
    return itemDay === filterDate;
  });

  const pendingAudits = filteredAudits.filter(a => !a.reviewed_by_admin);
  const resolvedAudits = filteredAudits.filter(a => a.reviewed_by_admin);
  const currentList = activeTab === 'pending' ? pendingAudits : resolvedAudits;

  return (
    <div className="audits-page-wrapper">
      
      {/* 2-Column Split Workspace */}
      <div className="audits-split-grid">
        
        {/* Left Side: Audit Table / List */}
        <div className="audit-list-card shadow-premium">
          <div className="audit-list-header">
            <h3 className="card-inner-title">
              <CheckSquare size={18} className="icon-cyan"/>
              <span>Audit Log Table (Based on Selected Day)</span>
            </h3>

            {/*using the standard time/filter styling wrapper cleanly*/}
            <div className="filter-dropdown-container">
              <Calendar size={14} className="icon-grey" style={{ marginRight: '6px' }} />
              <select
                className="admin-time-select"
                value={filterDate || 'All'}
                onChange={(e) => {
                  setFilterDate(e.target.value);
                  setSelectedAudit(null);
                }}
              >
                <option value="All">All Logged Days</option>
                {uniqueDays.map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="audit-tab-ribbon">
            <button 
              type="button" 
              className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('pending');
                if (pendingAudits.length > 0) selectAuditItem(pendingAudits[0]);
                else selectAuditItem(null);
              }}
            >
              Low Confidence ({pendingAudits.length})
            </button>
            <button 
              type="button" 
              className={`tab-btn ${activeTab === 'resolved' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('resolved');
                if (resolvedAudits.length > 0) selectAuditItem(resolvedAudits[0]);
                else selectAuditItem(null);
              }}
            >
              Reviewed ({resolvedAudits.length})
            </button>
          </div>

          {/* Tag fix: This container now stays neatly inside your list card container */}
          <div className="audit-table-container">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Category</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {currentList.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="empty-table-cell">
                      No audits logged in this section.
                    </td>
                  </tr>
                ) : (
                  currentList.map((item) => (
                    <tr 
                      key={item.id} 
                      className={`audit-row-item ${selectedAudit?.id === item.id ? 'selected' : ''}`}
                      onClick={() => selectAuditItem(item)}
                    >
                      <td className="audit-id-col">#{item.id}</td>
                      <td className="audit-category-col">
                        <span className={`category-indicator ${item.predicted_category.toLowerCase()}`}></span>
                        {item.predicted_category}
                      </td>
                      <td className="audit-confidence-col">
                        <div className="confidence-cell-wrapper">
                          <span className="confidence-text">{item.confidence_score}%</span>
                          <div className="mini-progress-track">
                            <div 
                              className="mini-progress-bar" 
                              style={{ width: `${item.confidence_score}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div> {/* <-- Closed perfectly here now! */}

        {/* Right Side: Resolution Workspace */}
        <div className="resolution-workspace-card shadow-premium">
          {selectedAudit ? (
            <form onSubmit={handleConfirmResolution} className="workspace-form">
              
              {/* Workspace Header */}
              <div className="workspace-header">
                <div>
                  <h3 className="workspace-title">Resolution Workspace</h3>
                  <p className="workspace-subtitle">
                    Reviewing Audit Item <span className="highlight-tag">#{selectedAudit.id}-{selectedAudit.predicted_category.toUpperCase()}-2026</span>
                  </p>
                </div>
                <div className="badge-critical">Critical Audit</div>
              </div>

              {/* Status Message Overlay banner */}
              {statusMsg.text && (
                <div className={`alert-banner ${statusMsg.type === 'success' ? 'alert-success' : 'alert-error'}`}>
                  {statusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{statusMsg.text}</span>
                </div>
              )}

              {/* Grid content for Workspace details */}
              <div className="workspace-details-grid">
                
                {/* Visual Image Preview Panel */}
                <div className="workspace-preview-panel">
                  <span className="panel-section-title">ORIGINAL UPLOAD IMAGE PREVIEW</span>
                  <div className="image-frame-container">
                    <img 
                      src={selectedAudit.image_url} 
                      alt="waste scan source preview" 
                      className="workspace-image-preview"
                    />
                  </div>
                </div>

                {/* Explanation text edit area */}
                <div className="workspace-diagnostic-panel">
                  <span className="panel-section-title">AUTOMATED DIAGNOSTIC</span>
                  <div className="textarea-wrapper">
                    <textarea
                      className="diagnostic-textarea"
                      placeholder="Input human friendly classification explanation..."
                      value={editExplanation}
                      onChange={(e) => setEditExplanation(e.target.value)}
                      required
                    ></textarea>
                  </div>
                  <p className="diagnostic-help-text">
                    Note: If the auto-generated explanation is not clear for reports, adjust it to be human friendly.
                  </p>
                </div>
              </div>

              {/* Reviewed by Admin toggle */}
              <div className="workspace-action-row">
                <div className="toggle-control-group">
                  <span className="toggle-label">Reviewed by Admin</span>
                  <button 
                    type="button" 
                    className={`toggle-switch-btn ${reviewedToggle ? 'checked' : ''}`}
                    onClick={() => setReviewedToggle(!reviewedToggle)}
                  >
                    {reviewedToggle ? (
                      <ToggleRight size={38} className="toggle-icon icon-mint" />
                    ) : (
                      <ToggleLeft size={38} className="toggle-icon icon-grey" />
                    )}
                  </button>
                </div>

                <button 
                  type="submit" 
                  className="btn-confirm-audit"
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving Resolution...' : 'Confirm Audit Resolution'}
                </button>
              </div>

              {/* Activity Timeline and Precision Score box */}
              <div className="workspace-footer-metrics-grid">
                
                {/* Activity Timeline widget populated from real backend data array */}
                <div className="timeline-widget">
                  <span className="widget-uppercase-title">
                    <Clock size={12} style={{ marginRight: '4px' }} />
                    ACTIVITY TIMELINE
                  </span>
                  
                  <div className="timeline-flow">
                    {selectedAudit.timeline && selectedAudit.timeline.length > 0 ? (
                      selectedAudit.timeline.map((event, index) => (
                        <div key={index} className="timeline-node-item">
                          <div className="node-indicator">
                            <span className={`node-dot ${index === 0 ? 'active' : ''}`}></span>
                            {index < selectedAudit.timeline.length - 1 && <span className="node-connector-line"></span>}
                          </div>
                          <div className="node-content">
                            <span className="node-time-label">{event.time}</span>
                            <p className="node-description-text">{event.text}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="timeline-node-item">
                        <div className="node-indicator">
                          <span className="node-dot active"></span>
                        </div>
                        <div className="node-content">
                          <span className="node-time-label">System Log</span>
                          <p className="node-description-text">Audit flagged dynamically for low model inference score.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Accuracy Box (Showing real Monthly Precision score metrics) */}
                <div className="accuracy-badge-box">
                  <span className="accuracy-value">
                    {typeof monthlyPrecision === 'number' ? `${monthlyPrecision.toFixed(1)}%` : monthlyPrecision}
                  </span>
                  <span className="accuracy-label">Monthly Precision Score</span>
                </div>

              </div>

            </form>
          ) : (
            <div className="empty-workspace">
              <AlertCircle size={40} className="icon-grey" style={{ marginBottom: '12px' }} />
              <p>Select an audit log item from the table to begin resolution.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default AdminAudits;