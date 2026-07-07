// frontend/src/components/AdminOverview.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Calendar, ShieldCheck, AlertOctagon, BarChart3 } from 'lucide-react';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import api from '../utils/api';
import { getMockSummaryMetrics } from '../utils/adminMockData';
import './styles/AdminDashboard.css';
 
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
);
 
// ─── helpers ────────────────────────────────────────────────────────────────
 
// Returns YYYY-MM-DD string in local timezone
const toLocalDateString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
 
const STANDARD_CATEGORIES = ['Plastic', 'Organic', 'Paper', 'Glass', 'Metal'];
const CATEGORY_COLORS = {
  Plastic: '#00BFA5',
  Organic: '#FF9100',
  Paper:   '#2979FF',
  Glass:   '#FFD600',
  Metal:   '#AA3BFF',
};
 
// ─── component ───────────────────────────────────────────────────────────────
 
const AdminOverview = () => {
  const { userTimezone } = useOutletContext() || {userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone};
 
  const [loading, setLoading]         = useState(true);
  const [metrics, setMetrics]         = useState(null);
  const [usingMock, setUsingMock]     = useState(false);
  const [filterDate, setFilterDate]   = useState('');          // '' = today
  const [searchTerm, setSearchTerm]   = useState('');
 
  // Listen to search events fired from AdminShell header
  useEffect(() => {
    const handler = (e) => setSearchTerm(e.detail);
    window.addEventListener('admin-search', handler);
    return () => window.removeEventListener('admin-search', handler);
  }, []);
 
  // ── fetch ────────────────────────────────────────────────────────────────
  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ timezone: userTimezone });
      if (filterDate) params.set('filter_date', filterDate);
 
      const response = await api.get(`/api/admin/dashboard-summary?${params.toString()}`);
      if (response.data?.success) {
        setMetrics(response.data.metrics);
        setUsingMock(false);
      } else {
        throw new Error('bad response');
      }
    } catch {
      console.warn('Dashboard API not reachable — using mock data.');
      setMetrics(getMockSummaryMetrics());
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, [userTimezone, filterDate]);
 
  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);
 
  // ── search filter applied to category distribution ────────────────────────
  const filteredDistribution = (metrics?.category_distribution || []).filter((c) =>
    searchTerm === '' || c.category.toLowerCase().includes(searchTerm)
  );
 
  // ── loading state ─────────────────────────────────────────────────────────
  if (loading || !metrics) {
    return (
      <div className="admin-loading-screen">
        <div className="spinner"></div>
        <p className="loading-text">Loading dashboard analytics...</p>
      </div>
    );
  }
 
  // ── chart: line — daily trend (success vs low-confidence) ─────────────────
  const lineChartData = {
    labels: metrics.daily_trend.map((d) => d.label),
    datasets: [
      {
        label: 'High Confidence',
        data: metrics.daily_trend.map((d) => d.successCount),
        borderColor: '#00BFA5',
        backgroundColor: 'rgba(0,191,165,0.1)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#00BFA5',
        pointBorderColor: '#0B0E23',
        pointHoverRadius: 5,
      },
      {
        label: 'Low Confidence',
        data: metrics.daily_trend.map((d) => d.retryCount),
        borderColor: '#7E85B7',
        backgroundColor: 'transparent',
        borderWidth: 2,
        fill: false,
        tension: 0.4,
        borderDash: [5, 5],
        pointBackgroundColor: '#7E85B7',
        pointBorderColor: '#0B0E23',
      },
    ],
  };
 
  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 2.4,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: { color: '#A0A5C3', font: { family: 'Outfit', size: 12 } },
      },
      tooltip: {
        backgroundColor: '#1E2761',
        titleFont: { family: 'Outfit', size: 13, weight: 'bold' },
        bodyFont: { family: 'Outfit', size: 12 },
        borderColor: 'rgba(99,253,211,0.3)',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#A0A5C3', font: { family: 'Outfit', size: 11 } },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#A0A5C3', font: { family: 'Outfit', size: 11 } },
        beginAtZero: true,
      },
    },
  };
 
  // ── chart: bar — today per category ──────────────────────────────────────
  const barChartData = {
    labels: filteredDistribution.map((c) => c.category),
    datasets: [
      {
        label: 'Items Today',
        data: filteredDistribution.map((c) => c.count_today ?? c.count),
        backgroundColor: filteredDistribution.map((c) =>
          `${CATEGORY_COLORS[c.category] || '#63FDD3'}4D`
        ),
        borderColor: filteredDistribution.map((c) =>
          CATEGORY_COLORS[c.category] || '#63FDD3'
        ),
        borderWidth: 1.5,
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };
 
  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 3,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1E2761',
        bodyFont: { family: 'Outfit', size: 12 },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#A0A5C3', font: { family: 'Outfit', size: 11 } },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#A0A5C3', font: { family: 'Outfit', size: 11 } },
        beginAtZero: true,
      },
    },
  };
 
  // ── chart: doughnut — monthly category proportion ─────────────────────────
  const doughnutData = {
    labels: filteredDistribution.map((c) => c.category),
    datasets: [
      {
        data: filteredDistribution.map((c) => c.count_month ?? c.count),
        backgroundColor: filteredDistribution.map(
          (c) => CATEGORY_COLORS[c.category] || '#63FDD3'
        ),
        borderColor: '#0B0E23',
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };
 
  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1,
    cutout: '70%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1E2761',
        bodyFont: { family: 'Outfit', size: 12 },
        borderColor: 'rgba(99,253,211,0.2)',
        borderWidth: 1,
      },
    },
  };
 
  const totalMonthItems =
    filteredDistribution.reduce((s, c) => s + (c.count_month ?? c.count), 0);
 
  // ── month label for display ───────────────────────────────────────────────
  const monthLabel = new Date().toLocaleString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: userTimezone,
  });
 
  return (
    <div className="overview-page-wrapper">
 
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="view-title-row">
        <div className="title-meta">
          <h2 className="main-page-title">System Overview</h2>
          <p className="main-page-subtitle">
            {monthLabel} — waste sorting metrics
            {usingMock && <span className="mock-badge">Demo Mode</span>}
          </p>
        </div>
 
        {/* Day picker filter */}
        <div className="header-actions-row">
          <div className="date-picker-btn">
            <Calendar size={16} />
            <input
              type="date"
              className="date-input-native"
              value={filterDate}
              max={toLocalDateString(new Date())}
              onChange={(e) => setFilterDate(e.target.value)}
              title="Filter charts by a specific day"
            />
            <span>{filterDate ? `Filtered: ${filterDate}` : 'Filter by day'}</span>
          </div>
          {filterDate && (
            <button className="filter-clear-btn" onClick={() => setFilterDate('')}>
              Clear
            </button>
          )}
        </div>
      </div>
 
      {/* ── Summary cards — monthly scope ───────────────────────────────── */}
      <div className="metrics-summary-grid">
 
        {/* Card 1: Total scans this month */}
        <div className="metric-card shadow-premium">
          <div className="card-top">
            <div className="card-icon-container bg-glow-cyan">
              <BarChart3 size={20} className="icon-cyan" />
            </div>
          </div>
          <div className="card-body">
            <span className="card-label">Total Scans This Month</span>
            <h3 className="card-massive-val">{metrics.total_sorted_month.toLocaleString()}</h3>
            <p className="card-sub-tip">
              Today: <strong>{metrics.total_sorted_today} items</strong>
            </p>
          </div>
          <div className="card-progress-track">
            <div className="card-progress-bar cyan-bar" style={{ width: '100%' }}></div>
          </div>
        </div>
 
        {/* Card 2: Monthly accuracy */}
        <div className="metric-card shadow-premium">
          <div className="card-top">
            <div className="card-icon-container bg-glow-green">
              <ShieldCheck size={20} className="icon-green" />
            </div>
          </div>
          <div className="card-body">
            <span className="card-label">Monthly Accuracy</span>
            <h3 className="card-massive-val">{metrics.correct_percentage_month}%</h3>
            <p className="card-sub-tip">
              Target baseline: <strong>85.0%</strong>
            </p>
          </div>
          <div className="card-progress-track">
            <div
              className="card-progress-bar green-bar"
              style={{ width: `${metrics.correct_percentage_month}%` }}
            ></div>
          </div>
        </div>
 
        {/* Card 3: Low confidence this month */}
        <div className="metric-card shadow-premium">
          <div className="card-top">
            <div className="card-icon-container bg-glow-red">
              <AlertOctagon size={20} className="icon-red" />
            </div>
          </div>
          <div className="card-body">
            <span className="card-label">Low Confidence This Month</span>
            <h3 className="card-massive-val">{metrics?.total_low_confidence_month != null
              ? metrics.total_low_confidence_month.toLocaleString()
              : '0'}</h3>
            <p className="card-sub-tip">Requires manual officer review</p>
          </div>
          <div className="card-progress-track">
            <div
              className="card-progress-bar red-bar"
              style={{ width: `${metrics.incorrect_percentage_month}%` }}
            ></div>
          </div>
        </div>
      </div>
 
      {/* ── Charts: line + doughnut ──────────────────────────────────────── */}
      <div className="charts-double-row">
 
        {/* Line chart — daily trend */}
        <div className="chart-container-card shadow-premium">
          <div className="chart-header">
            <h4 className="chart-card-title">Daily Sorting Trend</h4>
            <p className="chart-card-subtitle">
              {filterDate
                ? `Showing data for ${filterDate}`
                : 'High confidence vs low confidence — this month'}
            </p>
          </div>
          <div className="chart-canvas-wrapper">
            <Line data={lineChartData} options={lineChartOptions} />
          </div>
        </div>
 
        {/* Doughnut chart — monthly category proportion */}
        <div className="chart-container-card shadow-premium">
          <div className="chart-header">
            <h4 className="chart-card-title">Category Proportion</h4>
            <p className="chart-card-subtitle">Waste composition — this month</p>
          </div>
          <div className="doughnut-split-layout">
            <div className="doughnut-canvas-wrapper">
              <Doughnut data={doughnutData} options={doughnutOptions} />
              <div className="doughnut-center-labels">
                <span className="center-value">
                  {totalMonthItems >= 1000
                    ? `${(totalMonthItems / 1000).toFixed(1)}k`
                    : totalMonthItems}
                </span>
                <span className="center-label">TOTAL</span>
              </div>
            </div>
            <div className="doughnut-legends-list">
              {filteredDistribution.map((item) => (
                <div key={item.category} className="legend-row-item">
                  <div className="legend-label-col">
                    <span
                      className="legend-color-dot"
                      style={{ backgroundColor: CATEGORY_COLORS[item.category] || '#63FDD3' }}
                    ></span>
                    <span className="legend-label-text">{item.category}</span>
                  </div>
                  <span className="legend-value-text">{item.percentage_month ?? item.percentage}%</span>
                </div>
              ))}
              {filteredDistribution.length === 0 && (
                <p className="legend-empty-text">No categories match your search.</p>
              )}
            </div>
          </div>
        </div>
      </div>
 
      {/* ── Bar chart — today per category ──────────────────────────────── */}
      <div className="charts-single-row">
        <div className="chart-container-card shadow-premium">
          <div className="chart-header">
            <h4 className="chart-card-title">Category Breakdown</h4>
            <p className="chart-card-subtitle">
              {filterDate ? `Items sorted on ${filterDate}` : 'Items sorted today by category'}
            </p>
          </div>
          <div className="chart-canvas-wrapper">
            <Bar data={barChartData} options={barChartOptions} />
          </div>
        </div>
      </div>
 
      {/* ── Footer — today's count ───────────────────────────────────────── */}
      <footer className="admin-status-footer shadow-premium">
        <p className="footer-today-count">
          <span className="footer-count-number">{metrics.total_sorted_today}</span>
          &nbsp;classification{metrics.total_sorted_today !== 1 ? 's' : ''} recorded today
        </p>
        <p className="footer-timezone-label">Timezone: {userTimezone}</p>
      </footer>
 
    </div>
  );
};
 
export default AdminOverview;