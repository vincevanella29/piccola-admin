import React from 'react';
import useBreakpoint from './components/useBreakpoint';
import EmpresasListDesktop from './components/EmpresasListDesktop';
import EmpresasListMobile from './components/EmpresasListMobile';

const EmpresasList = (props) => {
  const isMobile = useBreakpoint('(max-width: 767px)'); // < md
  return isMobile ? <EmpresasListMobile {...props} /> : <EmpresasListDesktop {...props} />;
};

export default EmpresasList;
