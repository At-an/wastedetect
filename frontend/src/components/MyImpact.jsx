// frontend/src/components/MyImpact.jsx
import React, { useEffect, useState } from 'react';
import { Bell, ChevronRight } from 'lucide-react';
import api from '../utils/api';
import './styles/MyImpact.css';

const MyImpact = () => {
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [metrics, setMetrics] = useState({
    total_items_sorted: 0,
    active_streak_days: 0,
    distribution: []
  });
  const [recentScans, setRecentScans] = useState([]);

  useEffect(() => {
    const fetchImpactData = async () => {
      try {
        const summaryResponse = await api.get('/api/analytics/summary');
        if (summaryResponse.data.success) {
          setMetrics(summaryResponse.data.metrics);
        }

        const historyResponse = await api.get('/api/classifications/history'); 
        if (historyResponse.data.success) {
          setRecentScans(historyResponse.data.scans);
        }
      } catch (err) {
        console.error("Error retrieving dashboard payload:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchImpactData();
  }, []);

  // Included 'Paper' explicitly into the filter workflow sequences
  const filterCategories = ['All', 'Plastic', 'Organic', 'Paper', 'Glass', 'Metal'];

  const getCategoryCount = (categoryName) => {
    const found = metrics.distribution.find(item => 
      item.category.toLowerCase().includes(categoryName.toLowerCase())
    );
    return found ? found.count : 0;
  };

  const filteredScans = recentScans.filter(scan => {
    if (selectedFilter === 'All') return true;
    return scan.predicted_category.toLowerCase().includes(selectedFilter.toLowerCase());
  });

  if (loading) {
    return (
      <div className="impact-view-container flex-center">
        <div className="spinner"></div>
        <p className="loading-text">Assembling impact record data...</p>
      </div>
    );
  }

  return (
    <div className="impact-view-container">
      
      {/* FIXED STRUCTURE: Compact branding nav bar tracking perfect horizontal center alignment */}
      <div className="top-branding-bar">
        <div className="logo-inline-row" style={{ display: 'flex', alignItems: 'center', gap: '100px' }}>
          <img 
            src="/wastedetect_logo.png" 
            alt="WasteDetect Logo" 
            className="app-logo-inline-img"
            style={{ width: '70px', height: '70px', objectFit: 'contain' }} 
          />
        </div>
        <button className="notification-bell-btn">
          <Bell size={20} />
          <span className="bell-badge-dot"></span>
        </button>
      </div>

      <header className="view-header-block">
        <h1 className="main-impact-title">My  Impact</h1>
        <p className="main-impact-subtitle">Your effort to reduce waste and protect the environment.</p>
      </header>

      <div className="hero-stats-twin-grid">
        <div className="glass-card stat-summary-box">
          <span className="box-meta-label">TOTAL SORTED</span>
          <div className="box-value-row">
            <span className="box-massive-number">{metrics.total_items_sorted}</span>
            <span className="box-unit-label">Items</span>
          </div>
        </div>

        <div className="glass-card stat-summary-box">
          <span className="box-meta-label">ACTIVE STREAK</span>
          <div className="box-value-row">
            <span className="box-massive-number">{metrics.active_streak_days}</span>
            <span className="box-unit-label">⚡</span>
          </div>
        </div>
      </div>

      <div className="filter-ribbon-wrapper-container">
        <div className="horizontal-filter-ribbon">
          {filterCategories.map((cat) => (
            <button
              key={cat}
              className={`filter-pill-item ${selectedFilter === cat ? 'active' : ''}`}
              onClick={() => setSelectedFilter(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <section className="dashboard-activity-section">
        <h3 className="section-uppercase-title">RECENT ACTIVITY</h3>
        <div className="activity-cards-vertical-stack">
          {filteredScans.length === 0 ? (
            <div className="glass-card empty-feed-card">
              <p className="empty-message-text">No sorted items logged under "{selectedFilter}" category.</p>
            </div>
          ) : (
            filteredScans.map((scan) => (
              <div key={scan.id} className="glass-card activity-feed-row-item">
                <div className="activity-thumbnail-frame">
                  <img src={scan.image_url} alt="scan dynamic thumbnail" className="activity-img-element" />
                </div>
                
                <div className="activity-metadata-center">
                  <div className="activity-row-top">
                    <span className="activity-category-tag">{scan.predicted_category}</span>
                    <span className="activity-confidence-badge">{Math.round(scan.confidence_score)}% Con</span>
                  </div>
                  <span className="activity-action-tip">Sorted into active datastore</span>
                  <span className="activity-timestamp-label">
                    {new Date(scan.captured_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="activity-arrow-right">
                  <ChevronRight size={18} />
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* FIXED STRUCTURE: Breakdown Grid supports all 5 operational material segments */}
      <section className="dashboard-breakdown-section">
        <h3 className="section-uppercase-title">SCAN BREAKDOWN</h3>
        <div className="matrix-two-by-two-grid">
          <div className="glass-card matrix-count-cell">
            <span className="matrix-cell-label">Plastic</span>
            <span className="matrix-cell-counter">{getCategoryCount('Plastic')}</span>
          </div>
          <div className="glass-card matrix-count-cell">
            <span className="matrix-cell-label">Organic</span>
            <span className="matrix-cell-counter">{getCategoryCount('Organic')}</span>
          </div>
          <div className="glass-card matrix-count-cell">
            <span className="matrix-cell-label">Paper</span>
            <span className="matrix-cell-counter">{getCategoryCount('Paper')}</span>
          </div>
          <div className="glass-card matrix-count-cell">
            <span className="matrix-cell-label">Glass</span>
            <span className="matrix-cell-counter">{getCategoryCount('Glass')}</span>
          </div>
          <div className="glass-card matrix-count-cell full-width-cell">
            <span className="matrix-cell-label">Metal</span>
            <span className="matrix-cell-counter">{getCategoryCount('Metal')}</span>
          </div>
        </div>
      </section>

    </div>
  );
};

export default MyImpact;