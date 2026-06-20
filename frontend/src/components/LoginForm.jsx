// frontend/src/components/LoginForm.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';
import api from '../utils/api';
import './styles/AuthScreens.css';

const LoginForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Must render a checked form toggle labeled 'Keep me signed in / Remember me'
  const [rememberMe, setRememberMe] = useState(true);

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Extract initial email and message if redirected from registration
  useEffect(() => {
    if (location.state) {
      if (location.state.registeredEmail) {
        setTimeout(() => setEmail(location.state.registeredEmail), 0);
      }
      if (location.state.message) {
        setTimeout(() => setSuccessMsg(location.state.message), 0);
      }
    }
  }, [location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email || !password) {
      setErrorMsg('Email and password are required.');
      return;
    }

    setIsLoading(true);

    try {
      // POST authentication request to the backend API
      const response = await api.post('/api/auth/login', {
        email: email,
        password: password,
        remember_me: rememberMe
      });

      const { access_token, refresh_token, user } = response.data;

      // On submit success, persist the tokens cleanly inside the local environment
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      localStorage.setItem('user_profile', JSON.stringify(user));

      setSuccessMsg('Login successful! Accessing camera scanner...');

      // Redirect users to the camera home scanner dashboard
      setTimeout(() => {
        navigate('/app/scan');
      }, 1000);

    } catch (err) {
      if (err.response && err.response.data && err.response.data.error) {
        setErrorMsg(err.response.data.error);
      } else {
        setErrorMsg('Invalid email or password. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mobile-screen">
      <div className="geometric-bg">
        <div className="geo-shape-1"></div>
        <div className="geo-shape-2"></div>
      </div>

      <div className="screen-body">
        {/* Navigation Back */}
        <button className="back-button" onClick={() => navigate('/')}>
          <ArrowLeft size={16} /> Back
        </button>

        {/* Top Branding Section */}
        <div className="form-header">
          <div className="logo-wrapper" style={{ width: '80px', height: '80px', marginBottom: '12px' }}>
            <div className="logo-glow" style={{ width: '60px', height: '60px' }}></div>
            <img 
              src="/wastedetect_logo.png" 
              alt="WasteDetect Logo" 
              className="app-logo-img" 
            />
          </div>
          <h2 className="form-title">Welcome Back</h2>
          <p className="form-subtitle">Sign in to scan and classify waste items</p>
        </div>

        {/* Status Messages */}
        {errorMsg && (
          <div className="alert-banner alert-error">
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="alert-banner alert-success">
            <span>{successMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          {/* Email input */}
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <div className="input-container">
              <Mail size={18} className="input-icon" />
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
          </div>

          {/* Password input */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" htmlFor="password">Password</label>
            <div className="input-container">
              <Lock size={18} className="input-icon" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="form-input password-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Checked form toggle option labeled 'Keep me signed in / Remember me' */}
          <div className="form-options">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={isLoading}
              />
              <div className="custom-checkbox"></div>
              <span>Remember me</span>
            </label>
            <a href="#" className="forgot-password" onClick={(e) => e.preventDefault()}>
              Forgot?
            </a>
          </div>

          {/* Submit Action */}
          <button 
            type="submit" 
            className="btn-primary"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="spinner" /> Accessing...
              </>
            ) : 'Sign In'}
          </button>
        </form>

        <div className="form-footer">
          Don't have an account? 
          <a href="#" className="form-link" onClick={(e) => { e.preventDefault(); navigate('/register'); }}>
            Sign Up
          </a>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
