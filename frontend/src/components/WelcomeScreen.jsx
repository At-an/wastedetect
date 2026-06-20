// frontend/src/components/WelcomeScreen.jsx
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import './styles/AuthScreens.css';

const WelcomeScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="mobile-screen">
      <div className="geometric-bg">
        <div className="geo-shape-1"></div>
        <div className="geo-shape-2"></div>
      </div>
      
      <div className="screen-body">
        <div className="welcome-container">
          {/* Logo and Brand Header */}
          <div className="welcome-top">
            <div className="logo-wrapper">
              <div className="logo-glow"></div>
              <img 
                src="/wastedetect_logo.png" 
                alt="WasteDetect Logo" 
                className="app-logo-img"
              />
            </div>
            <h1 className="app-brand">WasteDetect</h1>
            <p className="app-tagline">Cleaner Communities, One Scan at a Time</p>
          </div>

          {/* Center Geometric Visual Card */}
          <div className="welcome-center">
            <div className="visual-card">
              <span className="feature-pill">Waste Classifier</span>
              <h3 className="feature-title">Scan and Sort</h3>
              <p className="feature-desc">
                Scan waste items, learn how to sort it and help HYSACAM keep our neighborhoods clean!
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="welcome-bottom">
            <button 
              className="btn-primary" 
              onClick={() => navigate('/register')}
            >
              Get Started <ArrowRight size={18} />
            </button>
            <button 
              className="btn-secondary" 
              onClick={() => navigate('/login')}
            >
              Sign In to Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
