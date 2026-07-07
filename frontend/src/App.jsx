// frontend/src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import WelcomeScreen from './components/WelcomeScreen';
import RegisterForm from './components/RegisterForm';
import LoginForm from './components/LoginForm';
import CitizenShell from './components/CitizenShell';
import './App.css';
import ScanHub from './components/ScanHub';
import MyImpact from './components/MyImpact';
import Profile from './components/Profile';
import AdminShell from './components/AdminShell';
import AdminOverview from './components/AdminOverview';
import AdminAudits from './components/AdminAudits';

function AppContent() {
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin');

  return (
    <div className={isAdminPath ? "admin-viewport" : "app-viewport"}>
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
          <Route path="profile" element={<Profile />} />
        </Route>

        {/* Protected Admin Console Shell with Nested Routing Outlets */}
        <Route path="/admin" element={<AdminShell />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<AdminOverview />} />
          <Route path="audits" element={<AdminAudits />} />
        </Route>
        
        {/* Catch-all redirection back to Welcome Portal */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

console.log(
  "API URL:",
  import.meta.env.VITE_API_URL
);

export default App;


