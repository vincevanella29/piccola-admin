import React from 'react';
import { Button } from '@mui/material';

const EmployeeDetailFooter = ({ t, onClose }) => {
  return (
    <Button
      variant="contained"
      onClick={onClose}
      className="bg-light-accent dark:bg-dark-accent hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover text-white rounded-xl"
    >
      {t('common.close')}
    </Button>
  );
};

export default EmployeeDetailFooter;
