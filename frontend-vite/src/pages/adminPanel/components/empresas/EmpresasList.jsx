import React from 'react';
import useBreakpoint from './components/companies/useBreakpoint';
import EmpresasListDesktop from './components/companies/EmpresasListDesktop';
import EmpresasListMobile from './components/companies/EmpresasListMobile';

const EmpresasList = (props) => {
  const isMobile = useBreakpoint('(max-width: 767px)'); // < md
  return isMobile ? <EmpresasListMobile {...props} /> : <EmpresasListDesktop {...props} />;
};

export default EmpresasList;
