// frontend/src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import WelcomeScreen from './components/WelcomeScreen';
import RegisterForm from './components/RegisterForm';
import LoginForm from './components/LoginForm';
import CitizenShell from './components/CitizenShell';
import './App.css';
import ScanHub from './components/ScanHub';
import MyImpact from './components/MyImpact';

//const MyImpact = () => <div style={{ color: '#fff', padding: '20px' }}>Impact View Placeholder</div>;
const UserProfile = () => <div style={{ color: '#fff', padding: '20px' }}>Profile View Placeholder</div>;

function App() {
  return (
    <div className="app-viewport">
      <BrowserRouter>
        <Routes>
        {/* Public Authentication Gateways */}
          <Route path="/" element={<WelcomeScreen />} />
          <Route path="/register" element={<RegisterForm />} />
          <Route path="/login" element={<LoginForm />} />
          
          {/* Protected Citizen Platform Shell with Nested Navigation Outlets */}
          <Route path="/app" element={<CitizenShell />}>
            {/* Index automatically transfers the routing context to the Scan screen */}
            <Route index element={<Navigate to="scan" replace />} />
            <Route path="scan" element={<ScanHub />} />
            <Route path="impact" element={<MyImpact />} />
            <Route path="profile" element={<UserProfile />} />
          </Route>
          
          {/* Catch-all redirection back to Welcome Portal */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
