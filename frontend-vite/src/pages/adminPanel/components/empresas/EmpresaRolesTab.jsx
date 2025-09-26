import React, { useState } from 'react';
import { ShieldCheck, Settings2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../../components/ui/Tabs';

import RoleScopesTab from './components/roles/RoleScopesTab.jsx';
import PoliciesTab from './components/roles/PoliciesTab.jsx';

const EmpresaRolesTab = ({ appState, t, prefetchedEmpresas = [], prefetchedSucursales = [] }) => {
  const [subtab, setSubtab] = useState('wallet'); // 'wallet' | 'policies'

  return (
    <div className="space-y-6">
      <Tabs>
        <div className="overflow-x-auto pb-2 -mb-2">
          <TabsList>
            <TabsTrigger
              isActive={subtab === 'wallet'}
              onClick={() => setSubtab('wallet')}
              icon={ShieldCheck}
              className="whitespace-nowrap"
            >
              {t?.('empresa.tab_wallet_scopes') || 'Wallet Scopes'}
            </TabsTrigger>
            <TabsTrigger
              isActive={subtab === 'policies'}
              onClick={() => setSubtab('policies')}
              icon={Settings2}
              className="whitespace-nowrap"
            >
              {t?.('empresa.tab_policies') || 'Políticas Cargo/Sección'}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent isActive={subtab === 'wallet'}>
          <RoleScopesTab
            appState={appState}
            t={t}
            prefetchedEmpresas={prefetchedEmpresas}
            prefetchedSucursales={prefetchedSucursales}
          />
        </TabsContent>

        <TabsContent isActive={subtab === 'policies'}>
          <PoliciesTab
            appState={appState}
            t={t}
            prefetchedEmpresas={prefetchedEmpresas}
            prefetchedSucursales={prefetchedSucursales}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EmpresaRolesTab;
