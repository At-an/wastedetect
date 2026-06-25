// frontend/src/components/ScanHub.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Camera as CameraIcon, Upload, AlertCircle, CheckCircle, RefreshCw, Zap, RotateCw } from 'lucide-react';
import api from '../utils/api';
import './styles/ScanHub.css';

// Core atomic synchronization lock outsisde the re-rendering component state lifecycle to prevent multiple concurrent sync attempts
let isSyncing = false;

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
    const goOnline = async () => {
      setIsOnline(true);
      await syncOfflineQueue();
    }
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // 2. Force Initialize IndexedDB On Mount
  useEffect(() => {
    const initDB = indexedDB.open('WasteDetectDB', 1);

    initDB.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains('offline_scans')) {
        db.createObjectStore('offline_scans', {
          keyPath: 'id',
          autoIncrement: true
        });
      }
    };

    initDB.onsuccess = () => {
      console.log('WasteDetectDB ready');
    };

    startLiveCameraFeed();

    return () => {
      killActiveCameraChannels();
    };
  }, []);

  

  // Attach stream to video element whenever stream changes
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;

      videoRef.current.play().catch(err => {
        console.error("Video playback failed:", err);
      });
    }
  }, [stream]);

  // Safely shuts down any active hardware tracks
  const killActiveCameraChannels = () => {
    if (videoRef.current) {
      const activeStream = videoRef.current.srcObject;

      if (activeStream) {
        activeStream.getTracks().forEach(track =>
          track.stop()
        );
      }

      videoRef.current.srcObject = null;
    }

    setStream(null);
  };

  // Gracefully handles hardware initialization with an explicit hardware clearing process
  const startLiveCameraFeed = async () => {
    killActiveCameraChannels();
    setCameraError(false);
    setCapturedImage(null);
    setIsFlashOn(false);

    try {
      const activeCapture =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });

      setStream(activeCapture);

    } catch (err) {
      console.error(
        'Camera hardware assignment failure:',
        err
      );

      setCameraError(true);
    }
  };

  const toggleDeviceFlashlight = () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities?.();
    
    if (!capabilities?.torch) {
      alert("Flashlight control interface not available on this device configuration.");
      return;
    }

    const stateValue = !isFlashOn;
    track.applyConstraints({ advanced: [{ torch: stateValue }] })
      .then(() => setIsFlashOn(stateValue))
      .catch(e => console.error("Flash adjustments rejected:", e));
  };

  // Helper utility converting the local UI representation back into an actual raw binary Blob
  const convertBase64ToBinaryBlob = (base64DataString) => {
    const stringParts = base64DataString.split(',');
    const mimeMatch = stringParts[0].match(/:(.*?);/)[1];
    const rawBinaryData = atob(stringParts[1]);
    let totalLength = rawBinaryData.length;
    const arrayBufferView = new Uint8Array(totalLength);
    
    while (totalLength--) {
      arrayBufferView[totalLength] = rawBinaryData.charCodeAt(totalLength);
    }
    
    return new Blob([arrayBufferView], { type: mimeMatch });
  };

  // Add IndexedDB storage helper
  const saveToOfflineQueue = (fileBlob) => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('WasteDetectDB', 1);

      request.onsuccess = (e) => {
        const db = e.target.result;

        const transaction = db.transaction(
          'offline_scans',
          'readwrite'
        );

        const store = transaction.objectStore(
          'offline_scans'
        );

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

  // Sync function to save all queued offline scans to the server when back online
  const syncOfflineQueue = async () => {

    // Prevent multiple concurrent sync attempts
    if (isSyncing) return;
    isSyncing = true;
    try {
      const request = indexedDB.open('WasteDetectDB', 1);
      
      await new Promise ((resolveSync, rejectSync) => {
        request.onsuccess = (e) => {
          const db = e.target.result;

          const transaction = db.transaction(
            'offline_scans',
            'readwrite'
          );

          const store = transaction.objectStore(
            'offline_scans'
          );

          const getAllRequest = store.getAll();

          getAllRequest.onsuccess = async () => {
            const records = getAllRequest.result;

            // Clear lock and exit cleanly if there's nothing to process
            if(!records || records.length === 0) {
              resolveSync();
              return;
            }

            for (const record of records) {
              try {
                const formData = new FormData();

                formData.append(
                  'image',
                  record.file,
                  `offline_${Date.now()}.jpg`
                );
                formData.append('captured_at', record.timestamp);

                await api.post(
                  '/api/classifications/upload',
                  formData,
                  {
                    headers: {
                      'Content-Type': 'multipart/form-data'
                    }
                  }
                );

                await new Promise((resolveDelete, rejectDelete) => {
                  const deleteTransaction = db.transaction(
                    'offline_scans',
                    'readwrite'
                  );

                  const deleteStore = deleteTransaction.objectStore(
                    'offline_scans'
                  );
                  const deleteRequest = deleteStore.delete(record.id);

                  deleteRequest.onsuccess = () => resolveDelete();
                  deleteRequest.onerror = () => rejectDelete(deleteRequest.error);
                });

                console.log(
                  `Synced offline record ${record.id}`
                );
              } catch (err) {
                console.error(
                  `Failed syncing record ${record.id}`,
                  err
                );
              }
            }
            resolveSync(); //resolve the main lock wrapper when the iteration finishes
          };
          getAllRequest.onerror = () => rejectSync(getAllRequest.error);
        };
        request.onerror = () => rejectSync(request.error);
      });

    } catch (err) {
      console.error(
        'Offline sync process failed:',
        err
      );
    } finally {
      // Release the synchronization thread barrier securely
      isSyncing = false;
    }
  };

  const triggerShutterCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const vWidth = videoRef.current.videoWidth;
    const vHeight = videoRef.current.videoHeight;

    canvasRef.current.width = vWidth;
    canvasRef.current.height = vHeight;
    ctx.drawImage(videoRef.current, 0, 0, vWidth, vHeight);

    const base64Data = canvasRef.current.toDataURL('image/jpeg');
    setCapturedImage(base64Data);
    killActiveCameraChannels();
    executeInferencePipeline(base64Data);
  };

  const processManualFilePick = (e) => {
    const targetFile = e.target.files?.[0];
    if (!targetFile) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result;
      setCapturedImage(base64Data);
      killActiveCameraChannels();
      executeInferencePipeline(base64Data);
    };
    reader.readAsDataURL(targetFile);
  };

  const executeInferencePipeline = async (base64String) => {
    setIsProcessing(true);
    
    if (!isOnline) {
      try {
        const imageBlob = convertBase64ToBinaryBlob(base64String);
        await saveToOfflineQueue(imageBlob);

        setScanResult({
          category: "Cached Offline",
          tip: "Low Network Connectivity. Your entry has been securely stored to local cache and will automatically sync upon reconnection.",
          impact: "No specific impact information provided due to low network connectivity."
        });
      } catch (err) {
        console.error("Local persistence layer error:", err);
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    try {
      // 1. Convert the base64 capture into an actual structural binary file payload
      const imageBlob = convertBase64ToBinaryBlob(base64String);
      
      // 2. Package it inside an explicit FormData object mapping exactly to request.files['image']
      const uploadFormEnvelope = new FormData();
      uploadFormEnvelope.append('image', imageBlob, `scan_${Date.now()}.jpg`);

      // Append the absolute browseer timeline moment to match backend routing expectations
      uploadFormEnvelope.append('captured_at', new Date().toISOString());

      // 3. Post multipart payload data directly to the classifications upload path
      const response = await api.post('/api/classifications/upload', uploadFormEnvelope, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data && response.data.success) {
        setScanResult({
          ...response.data.data,
          impact: response.data.data.monthly_impact_message
        });
      } else {
        setScanResult({
          category: response.data?.data?.predicted_category || "Processing Complete",
          tip: response.data?.message || "Item processed successfully by classification engine infrastructure.",
          impact: response.data?.data?.monthly_impact_message || "No specific impact information provided due to low network connectivity."
        });
      }
    } catch (err) {
      console.error("Inference communication endpoint exception:", err);
      setScanResult({
        category: "Organic (Fallback)",
        tip: "Model inference encountered a connection issue. Standard sorting behavior protocols assign target composition to organic compost processing lines.",
        impact: "No specific impact information provided due to low network connectivity."
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Safe cleaner closing sequence that explicitly hooks your lens infrastructure back up
  const handleDismissResultModal = () => {
    setScanResult(null);
    requestAnimationFrame(() => {
      startLiveCameraFeed();
    });
  };

  return (
    <div className="tab-viewport spec-scan-view">
      
      {/* 1. BRANDING HEADER BAR WITH INTEGRATED LOGO */}
      <div className="top-branding-bar">
        <div className="logo-inline-row">
          <img 
            src="/wastedetect_logo.png" 
            alt="WasteDetect Logo" 
            className="app-logo-inline-img"
            style={{ width: '70px', height: '70px', objectFit: 'contain' }} 
          />
        </div>
        <div className={`status-badge-wrapper ${isOnline ? 'state-synced' : 'state-offline'}`}>
          <div className="status-badge">
            <span className="badge-pulse-indicator"></span>
            <span>{isOnline ? 'Synced' : 'Offline'}</span>
          </div>
        </div>
      </div>

      {/* 2. ADAPTIVE INFERENCE PREVIEW CAMERA CANVAS REGION */}
      <div className="scanner-viewport-frame">
        {cameraError && !capturedImage && (
          <div className="camera-error-shield">
            <AlertCircle size={36} color="#ef5350" />
            <p className="error-shield-text">
              Unable to lock system hardware lenses.<br />
              Verify app browser permission hooks.
            </p>
            <button type="button" className="util-circle-btn" onClick={startLiveCameraFeed} style={{ marginTop: '8px' }}>
              <RefreshCw size={18} />
            </button>
          </div>
        )}

        {/* Live Active Stream Track */}
        {stream && !capturedImage && (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="live-stream-feed"
          />
        )}

        {/* Frozen Inference Visual Source */}
        {capturedImage && (
          <img 
            src={capturedImage} 
            alt="frozen payload target" 
            className="frozen-canvas-capture"
          />
        )}

        {/* Floating Utility Overlay Tools */}
        {stream && !capturedImage && (
          <div className="floating-lens-hud">
            <button type="button" className={`util-circle-btn ${isFlashOn ? 'active' : ''}`} onClick={toggleDeviceFlashlight}>
              <Zap size={18} />
            </button>
          </div>
        )}

        {/* Hidden Layout Utility Node Elements */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      {/* 3. REFITTED ADAPTIVE CONTROL FOOTER PANEL */}
      <div className="scanner-control-pad spec-pad">
        {/* Gallery Image Picker */}
        <button 
          type="button" 
          className="btn-file-inline-picker" 
          onClick={() => fileInputRef.current?.click()}
          title="Upload image file"
        >
          <Upload size={20} />
        </button>

        {/* Main Operational Shutter Core */}
        <div className="master-shutter-outer-ring" onClick={capturedImage ? startLiveCameraFeed : triggerShutterCapture}>
          {capturedImage ? (
            <RotateCw size={24} color="var(--mint-green)" />
          ) : (
            <div className="shutter-inner-core" />
          )}
        </div>

        {/* Hardware Stream Refresh/Reset Button */}
        <button 
          type="button" 
          className="btn-file-inline-picker active-refresh" 
          onClick={startLiveCameraFeed}
          title="Reset active camera stream hardware connection"
        >
          {capturedImage ? <CameraIcon size={20} /> : <RefreshCw size={20} />}
        </button>

        <input 
          ref={fileInputRef}
          type="file" 
          onChange={processManualFilePick}
          accept="image/*" 
          style={{ display: 'none' }} 
        />
      </div>

      {/* 4. Processing Modal Overlay Screen */}
      {isProcessing && (
        <div className="modal-backdrop-blur">
          <div className="auth-card flex-center-column text-center">
            <div className="spinner"></div>
            <p style={{ marginTop: '16px', color: 'var(--text-primary)', fontFamily: 'var(--font-main)', fontSize: '14px' }}>
              AI Engine running...
            </p>
          </div>
        </div>
      )}

      {/* 5. Inference Classification Result Card Dialogue */}
      {scanResult && (
        <div className="modal-backdrop-blur">
          <div className="auth-card">
            <div className="modal-header-status" style={{ gap: '10px', marginBottom: '16px' }}>
              <CheckCircle size={24} color="var(--mint-green)" />
              <h3 className="form-title" style={{ margin: 0 }}>
                {scanResult.predicted_category || scanResult.category}
              </h3>
            </div>
            {scanResult.confidence_score !== undefined && scanResult.confidence_score > 0 && (
              <p style={{ color: 'var(--mint-green)', fontFamily: 'var(--font-main)', fontSize: '12px', textAlign: 'center', margin: '-8px 0 12px 0' }}>
                Confidence: {scanResult.confidence_score.toFixed(1)}%
              </p>
            )}
            <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-main)', fontSize: '13px', lineHeight: '1.6', marginBottom: '20px', textAlign: 'center' }}>
              {scanResult.tip}
            </p>
            <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-main)', fontSize: '13px', lineHeight: '1.6', marginBottom: '20px', textAlign: 'center' }}>
              {scanResult.impact}
            </p>
            <button className="btn-primary" onClick={handleDismissResultModal}>
              Dismiss View
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default ScanHub;