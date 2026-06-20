// frontend/src/components/ScanHub.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Camera as CameraIcon, Upload, AlertCircle, CheckCircle, RefreshCw, Zap, RotateCw } from 'lucide-react';
import api from '../utils/api';
import './styles/ScanHub.css';

const ScanHub = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [cameraError, setCameraError] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);

  // 1. Core Network Status Observers
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // 2. FORCE INITIALIZE INDEXEDDB ON MOUNT (Fixes the "No IndexedDB detected" issue)
  useEffect(() => {
    const initDB = indexedDB.open('WasteDetectDB', 1);
    initDB.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('offline_scans')) {
        db.createObjectStore('offline_scans', { keyPath: 'id', autoIncrement: true });
        console.log("IndexedDB 'offline_scans' store initialized successfully.");
      }
    };
    initDB.onsuccess = () => {
      console.log("WasteDetectDB structural verification clear.");
    };

    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    setCameraError(false);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera access blocked or unavailable:", err);
      setCameraError(true);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const toggleFlashlight = async () => {
    if (stream) {
      const track = stream.getVideoTracks()[0];
      try {
        const capabilities = track.getCapabilities();
        if (capabilities.torch) {
          await track.applyConstraints({
            advanced: [{ torch: !isFlashOn }]
          });
          setIsFlashOn(!isFlashOn);
        } else {
          alert("Flashlight utility hardware is unsupported on this device display container.");
        }
      } catch (err) {
        console.error("Torch activation interface failed:", err);
      }
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        setCapturedImage(blob);
        processClassificationPipeline(blob);
      }, 'image/jpeg', 0.85);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCapturedImage(file);
      processClassificationPipeline(file);
    }
  };

  const processClassificationPipeline = async (imageFile) => {
    setIsProcessing(true);
    setScanResult(null);

    if (!navigator.onLine) {
      try {
        await saveToOfflineQueue(imageFile);
        setScanResult({
          offline: true,
          category: "Offline Queue Active",
          tip: "Your waste image has been safely locked into the localized device's memory. It will sync automatically when signal returns."
        });
      } catch (err) {
        console.error("Database structural write failed:", err);
      }
      setIsProcessing(false);
      return;
    }

    const formData = new FormData();
    formData.append('image', imageFile);

    try {
      const response = await api.post('/api/classifications/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setScanResult(response.data.data);
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveToOfflineQueue = (fileBlob) => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('WasteDetectDB', 1);
      request.onsuccess = (e) => {
        const db = e.target.result;
        const transaction = db.transaction('offline_scans', 'readwrite');
        const store = transaction.objectStore('offline_scans');
        
        const record = {
          file: fileBlob,
          timestamp: new Date().toISOString()
        };
        
        const addRequest = store.add(record);
        addRequest.onsuccess = () => resolve();
        addRequest.onerror = () => reject(addRequest.error);
      };
      request.onerror = () => reject(request.error);
    });
  };

  return (
    <div className="tab-viewport spec-scan-view">
      {/* Design Matching Header Status Bar Ribbon */}
      <div className={`design-header-ribbon ${isOnline ? 'state-synced' : 'state-offline'}`}>
        <span className="app-title-stub">WasteDetect</span>
        <div className="status-badge">
          <div className="badge-dot"></div>
          <span>{isOnline ? 'Synced' : 'Offline'}</span>
        </div>
      </div>

      <div className="scanner-layout">
        {/* Floating AI active tracker indicator pill */}
        <div className="ai-status-pill-container">
          <div className="ai-active-pill">
            <span className="pulse-dot-green"></span>
            AI DETECTION ACTIVE
          </div>
        </div>

        {/* Viewport Frame Box */}
        <div className="camera-viewport-frame spec-frame">
          {cameraError ? (
            <div className="viewport-error-msg flex-center-column">
              <AlertCircle size={40} color="var(--text-secondary)" />
              <p style={{ margin: '12px 0' }}>Camera feed could not mount.</p>
              <button className="btn-action secondary" onClick={startCamera}>
                <RefreshCw size={14} /> Reset Frame Hook
              </button>
            </div>
          ) : (
            <video ref={videoRef} autoPlay playsInline muted className="live-stream-feed"></video>
          )}

          {/* Design Target Bounding Box Reticles */}
          <div className="scan-crosshairs">
            <div className="corner top-left"></div>
            <div className="corner top-right"></div>
            <div className="corner bottom-left"></div>
            <div className="corner bottom-right"></div>
          </div>

          <div className="point-helper-label">Point at bin or waste to scan</div>

          {/* Side Utility Action Row Buttons */}
          <div className="side-utility-dock">
            <button className={`util-circle-btn ${isFlashOn ? 'active' : ''}`} onClick={toggleFlashlight}>
              <Zap size={18} />
            </button>
            <button className="util-circle-btn" onClick={() => { stopCamera(); startCamera(); }}>
              <RotateCw size={18} />
            </button>
          </div>
        </div>

        {/* Center Control Capture Panel Trigger Footer */}
        <div className="scanner-control-pad spec-pad">
          <button className="btn-file-inline-picker" onClick={() => fileInputRef.current.click()} disabled={isProcessing}>
            <Upload size={20} />
          </button>

          <button className="btn-capture-trigger master-trigger-btn" onClick={capturePhoto} disabled={isProcessing || cameraError}>
            <div className="inner-ring-icon-bounds">
              <CameraIcon size={28} color="#070914" />
            </div>
          </button>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            style={{ display: 'none' }} 
          />
        </div>
      </div>

      {/* Processing Loader Overlay */}
      {isProcessing && (
        <div className="modal-backdrop-blur flex-center">
          <div className="auth-card flex-center-column text-center">
            <div className="spinner"></div>
            <p style={{ marginTop: '16px', color: 'var(--text-primary)' }}>Computing YOLO Inference...</p>
          </div>
        </div>
      )}

      {/* Result Card Modal Overlay Dialog */}
      {scanResult && (
        <div className="modal-backdrop-blur flex-center">
          <div className="auth-card animated fadeInUp">
            <div className="modal-header-status flex-center" style={{ gap: '8px', marginBottom: '16px' }}>
              <CheckCircle size={24} color="var(--mint-green)" />
              <h3 className="form-title" style={{ margin: 0 }}>
                {scanResult.predicted_category || scanResult.category}
              </h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
              {scanResult.tip}
            </p>
            <button className="btn-primary" onClick={() => setScanResult(null)}>
              Dismiss View
            </button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
    </div>
  );
};

export default ScanHub;