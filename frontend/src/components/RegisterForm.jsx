// frontend/src/components/RegisterForm.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Lock, ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';
import api from '../utils/api';
import './AuthScreens.css';

const RegisterForm = () => {
  const navigate = useNavigate();
  const [fullname, setFullname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!fullname || !email || !password) {
      setErrorMsg('All fields are required.');
      return;
    }

    setIsLoading(true);

    try {
      // POST to our backend registration endpoint
      await api.post('/api/auth/register', {
        Fullname: fullname,
        email: email,
        password: password
      });

      setSuccessMsg('Registration successful! Redirecting to login...');
      
      // Delay navigation slightly so user sees the success message
      setTimeout(() => {
        navigate('/login', { state: { registeredEmail: email, message: 'Registration successful! Please login.' } });
      }, 1500);

    } catch (err) {
      if (err.response && err.response.data && err.response.data.error) {
        setErrorMsg(err.response.data.error);
      } else {
        setErrorMsg('An unexpected error occurred. Please try again.');
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
          <h2 className="form-title">Join WasteDetect</h2>
          <p className="form-subtitle">Create your account to start smart sorting</p>
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

        {/* Registration Form */}
        <form onSubmit={handleSubmit}>
          {/* Fullname input */}
          <div className="form-group">
            <label className="form-label" htmlFor="fullname">Full Name</label>
            <div className="input-container">
              <User size={18} className="input-icon" />
              <input
                id="fullname"
                type="text"
                className="form-input"
                placeholder="John Doe"
                value={fullname}
                onChange={(e) => setFullname(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
          </div>

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
          <div className="form-group" style={{ marginBottom: '32px' }}>
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

          {/* Submit Action */}
          <button 
            type="submit" 
            className="btn-primary"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="spinner" /> Creating Account...
              </>
            ) : 'Sign Up'}
          </button>
        </form>

        <div className="form-footer">
          Already have an account? 
          <a href="#" className="form-link" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>
            Sign In
          </a>
        </div>
      </div>
    </div>
  );
};

export default RegisterForm;
