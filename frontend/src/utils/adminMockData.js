// frontend/src/utils/adminMockData.js

export const getMockSummaryMetrics = () => {
  return {
    total_sorted_today: 142,
    total_sorted_month: 4512,
    correct_percentage_today: 88.4,
    incorrect_percentage_today: 11.6,
    daily_accuracy: 88.4,
    daily_count: 142,
    streak_days: 12,
    category_distribution: [
      { category: 'Plastic', count: 64, percentage: 45.0, color: '#00BFA5' },
      { category: 'Organic', count: 36, percentage: 25.0, color: '#FF9100' },
      { category: 'Paper', count: 21, percentage: 15.0, color: '#2979FF' },
      { category: 'Glass', count: 14, percentage: 10.0, color: '#FFD600' },
      { category: 'Metal', count: 7, percentage: 5.0, color: '#AA3BFF' }
    ],
    daily_trend: [
      { label: 'MON', successCount: 220, retryCount: 20 },
      { label: 'TUE', successCount: 280, retryCount: 40 },
      { label: 'WED', successCount: 250, retryCount: 40 },
      { label: 'THU', successCount: 420, retryCount: 60 },
      { label: 'FRI', successCount: 540, retryCount: 50 },
      { label: 'SAT', successCount: 340, retryCount: 40 },
      { label: 'SUN', successCount: 440, retryCount: 50 }
    ]
  };
};

export const getMockAudits = () => {
  return [
    {
      id: 'A1',
      classification_id: 'class-uuid-001',
      predicted_category: 'Plastic',
      confidence_score: 42,
      image_url: 'https://images.unsplash.com/photo-1618477388954-7852f32655ec?w=500&auto=format&fit=crop&q=80',
      auto_generated_explanation: 'Low operational mapping metrics calculated (42%). Requires visual confirmation from human admin review systems.',
      reviewed_by_admin: false,
      timestamp: '10:24:02 AM',
      timeline: [
        { time: '10:24:02 AM', text: 'Detected item via Industrial Camera 4 (Low confidence trigger)' },
        { time: '10:25:15 AM', text: 'Flagged for manual review by System Admin' }
      ]
    },
    {
      id: 'B4',
      classification_id: 'class-uuid-002',
      predicted_category: 'Organic',
      confidence_score: 38,
      image_url: 'https://images.unsplash.com/photo-1595273670150-db0a3e398436?w=500&auto=format&fit=crop&q=80',
      auto_generated_explanation: 'Low operational mapping metrics calculated (38%). Requires visual confirmation from human admin review systems.',
      reviewed_by_admin: false,
      timestamp: '09:12:44 AM',
      timeline: [
        { time: '09:12:44 AM', text: 'Detected item via Public Bin Scanner 2 (Organic classifier match)' },
        { time: '09:15:20 AM', text: 'Flagged for manual review due to ambiguous texture properties' }
      ]
    },
    {
      id: 'C8',
      classification_id: 'class-uuid-003',
      predicted_category: 'Metal',
      confidence_score: 49,
      image_url: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=500&auto=format&fit=crop&q=80',
      auto_generated_explanation: 'Low operational mapping metrics calculated (49%). Requires visual confirmation from human admin review systems.',
      reviewed_by_admin: false,
      timestamp: '08:44:10 AM',
      timeline: [
        { time: '08:44:10 AM', text: 'Detected item via Sorting Line Intake A (Aluminum/Tin reflection anomaly)' },
        { time: '08:46:05 AM', text: 'Flagged for manual review by Automated Sorting Operator' }
      ]
    }
  ];
};

export const exportToCSVString = (records) => {
  const headers = ['Classification ID', 'User ID', 'Captured At', 'Predicted Category', 'Confidence Score', 'Is Low Confidence', 'Image URL', 'Reviewed By Admin', 'Audit Explanation'];
  
  const rows = records.map(r => [
    r.classification_id || r.id,
    r.user_id || 'U-ADMIN-01',
    r.captured_at || new Date().toISOString(),
    r.predicted_category,
    r.confidence_score + '%',
    r.confidence_score < 50 ? 'true' : 'false',
    r.image_url,
    r.reviewed_by_admin ? 'true' : 'false',
    `"${(r.auto_generated_explanation || '').replace(/"/g, '""')}"`
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
};
