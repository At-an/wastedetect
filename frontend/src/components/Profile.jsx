// frontend/src/components/Profile.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Settings, 
  HelpCircle, 
  LogOut, 
  BarChart3, 
  ChevronRight, 
  Bell, 
  Calendar 
} from 'lucide-react';
import api from '../utils/api';
import './styles/Profile.css';
import {formatToLocalTime} from '../utils/dateFormatter';

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState({
    fullName: "",
    email: "",
    memberSince: ""
  });

  // 1. Fetch live user data directly from the authenticated endpoint
  useEffect(() => {
    const pullProfileDatabaseRecord = async () => {
      try {
        const response = await api.get('/api/auth/profile');
        if (response.data && response.data.data) {
          const record = response.data.data;
          setUserData({
            fullName: record.full_name || "Eco Citizen",
            email: record.email || "citizen@wastedetect.org",
            memberSince: record.created_at || "2026-06-01"
          });
        } else if (response.data && response.data.user) {
          const record = response.data.user;
          setUserData({
            fullName: record.full_name || "Eco Citizen",
            email: record.email || "citizen@wastedetect.org",
            memberSince: record.created_at || "2026-06-01"
          });
        }
      } catch (err) {
        console.error("Database route request connection exception:", err);
        // Clean dynamic safety fallback if system token parameters linger locally
        setUserData({
          fullName: localStorage.getItem('user_fullname') || "Eco Citizen",
          email: localStorage.getItem('user_email') || "citizen@wastedetect.org",
          memberSince: "2026-06-15"
        });
      } finally {
        setLoading(false);
      }
    };

    pullProfileDatabaseRecord();
  }, []);

  // 2. Parse Initials and First Names Dynamically
  const getInitials = (name) => {
    if (!name) return "WD";
    const blocks = name.trim().split(/\s+/);
    if (blocks.length >= 2) {
      return `${blocks[0][0]}${blocks[1][0]}`.toUpperCase();
    }
    return blocks[0].substring(0, 2).toUpperCase();
  };

  const getFirstName = (name) => {
    if (!name) return "Citizen";
    return name.trim().split(/\s+/)[0];
  };

  const parseFormattedDate = (dateString) => {
    if (!dateString) return "June 2026";
    try {
      const parsed = new Date(dateString);
      if (isNaN(parsed.getTime())) return "June 2026";
      return parsed.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch {
      return "June 2026";
    }
  };

  // 3. Clear Backend Session Authentication
  const executeLogOutSequence = async () => {
    const verifyIntent = window.confirm("Are you sure you want to sign out of WasteDetect?");
    if (!verifyIntent) return;

    try {
      await api.post('/api/auth/logout');
    } catch (err) {
      console.error("Backend auth disconnect request failed:", err);
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="tab-viewport spec-profile-view">
      
      {/* Header Section - Seamlessly aligns application brand and Notification Bell */}
      <div className="design-header-ribbon">
        <div className="logo-inline-row">
          <img 
            src="/wastedetect_logo.png" 
            alt="WasteDetect Logo" 
            className="app-logo-inline-img"
            style={{ width: '70px', height: '70px', objectFit: 'contain' }} 
          />
        </div>
        <div className="header-icon-bell" onClick={() => alert("Notification feed clearing...")}>
          <Bell size={24} />
        </div>
      </div>

      {/* Dynamic Content Frame Layout Box Container */}
      <div className="profile-scroll-container">
        
        {loading ? (
          <div className="profile-user-card" style={{ padding: '40px 0' }}>
            <div className="spinner"></div>
          </div>
        ) : (
          <div className="profile-user-card">
            <div className="profile-avatar-initials">
              {getInitials(userData.fullName)}
            </div>
            <h2 className="profile-fullname">{getFirstName(userData.fullName)}</h2>
            <p className="profile-email-sub">{userData.email}</p>
            <div className="profile-join-pill">
              <Calendar size={14} />
              <span>Member Since {formatToLocalTime(userData.memberSince)}</span>
            </div>
          </div>
        )}

        {/* Overview Tracking Ingress Groups */}
        <div className="settings-menu-group">
          <span className="menu-section-title">Overview</span>
          
          {/* Aligns to relative endpoint context matching Route structure in App.jsx */}
          <button 
            type="button" 
            className="settings-row-item" 
            onClick={() => navigate('/app/impact')}
          >
            <div className="settings-left-side">
              <BarChart3 size={18} />
              <span>Classification History</span>
            </div>
            <ChevronRight size={16} color="rgba(255,255,255,0.2)" />
          </button>
        </div>

        {/* Mock Menu Structural Options */}
        <div className="settings-menu-group">
          <span className="menu-section-title">App Settings</span>
          
          <button type="button" className="settings-row-item" onClick={() => alert("Account settings context active.")}>
            <div className="settings-left-side">
              <Settings size={18} />
              <span>Account Settings</span>
            </div>
            <ChevronRight size={16} color="rgba(255,255,255,0.2)" />
          </button>

          <button type="button" className="settings-row-item" onClick={() => alert("Support channels active.")}>
            <div className="settings-left-side">
              <HelpCircle size={18} />
              <span>Help & Support</span>
            </div>
            <ChevronRight size={16} color="rgba(255,255,255,0.2)" />
          </button>
        </div>

        {/* Danger Zone Controls Section Layout */}
        <div className="settings-menu-group" style={{ marginTop: 'auto' }}>
          <span className="danger-zone-label">Danger Zone</span>
          <button 
            type="button" 
            className="master-logout-trigger" 
            onClick={executeLogOutSequence}
          >
            <LogOut size={18} />
            <span>Log Out</span>
          </button>

          {/*Authorship / Version Footer*/}
          <div className="profile-authorship-footer">
            <p className="authorship-disclaimer">
              Note: Deleting your profile will anonymize your past
              classification records to maintain database integrity while
              protecting your privacy.
            </p>

            <p className="authorship-version">
              WasteDetect v1.0.0 • Production
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Profile;