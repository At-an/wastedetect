// frontend/src/components/AdminShell.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { BarChart3, ShieldAlert, LogOut, Search, Bell, FileText, WifiOff, Wifi } from 'lucide-react';
import api from '../utils/api';
import './styles/AdminDashboard.css';
 
const AdminShell = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeMenu, setActiveMenu] = useState('overview');
  const [userProfile, setUserProfile] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(null);
  const [systemOnline, setSystemOnline] = useState(null);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
 
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
 
  // --- Health check every 30 seconds ---
  const checkSystemHealth = useCallback(async () => {
    try {
      await api.get('/health', { timeout: 5000 });
      setSystemOnline(true);
    } catch {
      setSystemOnline(false);
    }
  }, []);
 
  useEffect(() => {
    checkSystemHealth();
    const interval = setInterval(checkSystemHealth, 1000);
    return () => clearInterval(interval);
  }, [checkSystemHealth]);
 
  // --- Auth check ---
  useEffect(() => {
    const accessToken = localStorage.getItem('access_token');
    const profileStr = localStorage.getItem('user_profile');
 
    if (!accessToken || !profileStr) {
      setIsAuthorized(false);
      localStorage.clear();
      navigate('/login', { replace: true });
      return;
    }
 
    try {
      const profile = JSON.parse(profileStr);
      setUserProfile(profile);
      setIsAuthorized(profile.role === 'admin');
    } catch {
      setIsAuthorized(false);
    }
  }, [navigate]);
 
  // --- Track sidebar active state from URL ---
  useEffect(() => {
    const lastSegment = location.pathname.split('/').pop();
    if (['overview', 'audits'].includes(lastSegment)) {
      setActiveMenu(lastSegment);
    }
  }, [location]);
 
  // --- Logout ---
  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // proceed regardless
    } finally {
      localStorage.clear();
      navigate('/login', { replace: true });
    }
  };
 
  // --- New Report: download current month PDF ---
  const handleNewReport = async () => {
    setIsDownloadingReport(true);
    try {
      const response = await api.get(
        `/api/admin/export-pdf?timezone=${encodeURIComponent(userTimezone)}`,
        { responseType: 'blob' }
      );
      const now = new Date();
      const filename = `wastedetect_report_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}.pdf`;
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Monthly report is not available yet. It will be ready once classifications have been recorded this month.');
    } finally {
      setIsDownloadingReport(false);
    }
  };
 
  if (isAuthorized === null) {
    return (
      <div className="admin-loading-screen">
        <div className="spinner"></div>
        <p className="loading-text">Validating administrator credentials...</p>
      </div>
    );
  }
 
  if (isAuthorized === false) {
    return (
      <div className="unauthorized-container">
        <div className="unauthorized-card">
          <ShieldAlert size={64} className="unauthorized-icon" />
          <h2 className="unauthorized-title">Access Restricted</h2>
          <p className="unauthorized-desc">
            You do not have administrator credentials to access this console.
          </p>
          <div className="unauthorized-actions">
            <button className="btn-primary" onClick={() => navigate('/login', { replace: true })}>
              Sign In with Admin Account
            </button>
            <button className="btn-secondary" onClick={() => navigate('/app/scan', { replace: true })}>
              Return to Citizen App
            </button>
          </div>
        </div>
      </div>
    );
  }
 
  return (
    <div className="admin-layout-container">
 
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="sidebar-top">
          <div className="brand-group">
            <img src="/wastedetect_logo.png" alt="WasteDetect Logo" className="admin-sidebar-logo" />
            <div className="brand-meta">
              <span className="brand-title">HYSACAM</span>
              <span className="brand-subtitle">Waste Management</span>
            </div>
          </div>
 
          <nav className="sidebar-nav">
            <Link
              to="/admin/overview"
              className={`sidebar-nav-item ${activeMenu === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveMenu('overview')}
            >
              <BarChart3 size={20} />
              <span>Overview</span>
            </Link>
 
            <Link
              to="/admin/audits"
              className={`sidebar-nav-item ${activeMenu === 'audits' ? 'active' : ''}`}
              onClick={() => setActiveMenu('audits')}
            >
              <FileText size={20} />
              <span>Audits</span>
            </Link>
          </nav>
        </div>
 
        <div className="sidebar-bottom">
          <button
            type="button"
            className="sidebar-btn-report"
            onClick={handleNewReport}
            disabled={isDownloadingReport}
          >
            {isDownloadingReport ? 'Compiling...' : '+ New Report'}
          </button>
 
          <button type="button" className="sidebar-nav-item logout-btn" onClick={handleLogout}>
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
 
      {/* Main Canvas */}
      <div className="admin-main-canvas">
 
        <header className="admin-top-header">
          {/* Search - fires custom event that AdminOverview listens to */}
          <div className="header-search-wrapper">
            <Search size={18} className="search-icon" />
            <input
              id="admin-global-search"
              type="text"
              placeholder="Filter by category (Plastic, Metal, Glass...)"
              className="header-search-input"
              onChange={(e) => {
                window.dispatchEvent(
                  new CustomEvent('admin-search', { detail: e.target.value.trim().toLowerCase() })
                );
              }}
            />
          </div>
 
          <div className="header-controls">
            {/* Real system health status */}
            <div className={`status-pill ${systemOnline === false ? 'status-offline' : ''}`}>
              {systemOnline === false
                ? <WifiOff size={14} className="status-icon-offline" />
                : <Wifi size={14} className="status-icon-online" />
              }
              <span className={`status-dot ${systemOnline === false ? 'dot-offline' : ''}`}></span>
              <span className="status-label">
                {systemOnline === null ? 'Checking...' : systemOnline ? 'System Online' : 'System Offline'}
              </span>
            </div>
 
            <button type="button" className="icon-control-btn" title="Notifications">
              <Bell size={20} />
              <span className="notification-dot"></span>
            </button>
 
            <div className="admin-user-profile">
              <div className="profile-meta">
                <span className="profile-name">{userProfile?.Fullname || 'HYSACAM Officer'}</span>
                <span className="profile-role">Administrator</span>
              </div>
              <div className="profile-avatar">
                {userProfile?.Fullname ? userProfile.Fullname.substring(0, 2).toUpperCase() : 'AD'}
              </div>
            </div>
          </div>
        </header>
 
        <main className="admin-route-content">
          <Outlet context={{ userTimezone }} />
        </main>
      </div>
    </div>
  );
};
 
export default AdminShell;