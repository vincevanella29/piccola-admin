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
  category: 'team.category',
  minRoleLevel: 3,
  maxRoleLevel: 6,
  order: 1,
  orderWalletMenu: 1,
  orderFooter: 1,
  locations: ['sidebar', 'footer', 'walletMenu'],
  description: 'employees.description',
  icon: 'FaIdCard',
  isMainPage: false,
  isSearchable: true,
};