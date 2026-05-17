import React from 'react';
import CTAnalyticsDashboard from './analytics/CTAnalyticsDashboard.jsx';

// Wrapper to maintain compatibility with ConversionTrackerApp
const CTAnalytics = (props) => {
  return <CTAnalyticsDashboard {...props} />;
};

export default CTAnalytics;
