import React from 'react';
import EmployeesTable from './components/EmployeesTable.jsx';


const Employees = ({ appState }) => {
    return (
    <div className="p-4">
      <EmployeesTable appState={appState} />
    </div>
  );
};

export default Employees;

export const pageMetadata = {
  path: '/app/analytics/employees',
  label: 'employees.label',
  category: 'analytics.Análisis',
  minRoleLevel: 3,
  maxRoleLevel: 6,
  order: 2,
  orderWalletMenu: 2,
  orderFooter: 1,
  locations: ['sidebar', 'header', 'footer', 'walletMenu'],
  description: 'employees.description',
  icon: 'FaUsers',
  isMainPage: false,
  isSearchable: true,
};