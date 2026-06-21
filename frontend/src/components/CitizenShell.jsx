// frontend/src/components/CitizenShell.jsx
import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Camera, BarChart3, User } from 'lucide-react';
import api from '../utils/api'; 
import './styles/CitizenShell.css';

const CitizenShell = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('scan');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    // 1. Structural Token Presence Check
    const accessToken = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');

    if (!accessToken || !refreshToken) {
      console.warn("Missing session signatures. Redirecting to security gate.");
      localStorage.clear();
      navigate('/login', { replace: true });
      return;
    }

    // 2. Local State Authorization
    // We instantly trust the token structure to render the layout base.
    // Your api.js Axios interceptor will catch any background token expirations smoothly.
    setIsCheckingAuth(false);

    // 3. Keep the active navigation tab highlighted on browser reloads
    const currentPath = location.pathname.split('/').pop();
    if (['scan', 'impact', 'profile'].includes(currentPath)) {
      setActiveTab(currentPath);
    }
  }, [location, navigate]);

  // =========================================================================
  // STEP 3: Implement the Auto-Sync Background Network Synchronizer Loop
  // =========================================================================
  useEffect(() => {
    const triggerBackgroundSyncPipeline = () => {
      const request = indexedDB.open('WasteDetectDB', 1);

      request.onsuccess = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('offline_scans')) return;

        const transaction = db.transaction('offline_scans', 'readwrite');
        const store = transaction.objectStore('offline_scans');
        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = async () => {
          const records = getAllRequest.result;
          if (records.length === 0) return;

          console.log(`Network connection restored! Synchronizing ${records.length} historical offline records...`);

          for (const record of records) {
            const formData = new FormData();
            formData.append('image', record.file);
            
            // Note: If you want to sync the historical timestamp down the line,
            // you can pass it as a custom header or query string parameter:
            // formData.append('captured_at', record.timestamp);

            try {
              // Dispatch the historical data payload directly to our upgraded persistence endpoint
              await api.post('/api/classifications/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
              });

              // Clean up the local IndexedDB record once the server confirms a successful save
              const deleteTransaction = db.transaction('offline_scans', 'readwrite');
              deleteTransaction.objectStore('offline_scans').delete(record.id);
              console.log(`Successfully synced and cleared record entry ID: ${record.id}`);
            } catch (err) {
              console.error(`Synchronization failed for record ID ${record.id}. Saving for next network window:`, err);
              break; // Stop processing the loop if the server connection drops off mid-upload
            }
          }
        };
      };
    };

    window.addEventListener('online', triggerBackgroundSyncPipeline);
    return () => window.removeEventListener('online', triggerBackgroundSyncPipeline);
  }, []);
  // =========================================================================
  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    navigate(`/app/${tabName}`);
  };

  // Render our custom glassmorphic loader while verification keys mount
  if (isCheckingAuth) {
    return (
      <div className="mobile-screen flex-center" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="geometric-bg">
          <div className="geo-shape-1"></div>
          <div className="geo-shape-2"></div>
        </div>
        <div className="auth-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="spinner"></div>
          <p style={{ color: 'var(--text-secondary)', marginTop: '16px', fontFamily: 'var(--font-main)', fontSize: '14px' }}>
            Verifying encryption keys...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-screen">
      {/* Background Canvas Layer */}
      <div className="geometric-bg">
        <div className="geo-shape-1"></div>
        <div className="geo-shape-2"></div>
      </div>

      {/* Main Tab View Area */}
      <div className="shell-content-container">
        <Outlet />
      </div>

      {/* Persistent Bottom Tab Footer Bar */}
      <nav className="bottom-nav-bar">
        <button 
          className={`nav-tab-item ${activeTab === 'scan' ? 'active' : ''}`}
          onClick={() => handleTabChange('scan')}
        >
          <Camera size={22} />
          <span className="tab-label">Scan</span>
        </button>

        <button 
          className={`nav-tab-item ${activeTab === 'impact' ? 'active' : ''}`}
          onClick={() => handleTabChange('impact')}
        >
          <BarChart3 size={22} />
          <span className="tab-label">My Impact</span>
        </button>

        <button 
          className={`nav-tab-item ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => handleTabChange('profile')}
        >
          <User size={22} />
          <span className="tab-label">Profile</span>
        </button>
      </nav>
    </div>
  );
};

export default CitizenShell;
