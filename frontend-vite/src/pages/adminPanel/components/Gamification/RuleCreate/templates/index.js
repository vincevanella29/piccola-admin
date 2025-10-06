// RuleCreate templates index
// Define available rule templates for the Admin Panel UI

import { attendanceTemplate } from './template_attendance_full_month.jsx';
import { salesRankingTemplate } from './template_sales_ranking_position.jsx';
import { salesTopCategoryTemplate } from './template_sales_top_category.jsx';
import { timesMetricsEmployeeTemplate } from './template_times_metrics_employee.jsx';
import { timesMetricsLocalTemplate } from './template_times_metrics_local.jsx';
import { adminSalesRankingTemplate } from './template_admin_sales_ranking_position.jsx';
import { adminSalesTopCategoryTemplate } from './template_admin_sales_top_category.jsx';

export const RULE_TEMPLATES = [
  attendanceTemplate,
  salesRankingTemplate,
  salesTopCategoryTemplate,
  timesMetricsEmployeeTemplate,
  timesMetricsLocalTemplate,
  adminSalesRankingTemplate,
  adminSalesTopCategoryTemplate,
];
