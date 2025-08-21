import { useMemo, useState } from 'react';
import { getCompanyUsersApi, getUserRoleApi, assignCompanyRoleApi, revokeCompanyRoleApi } from '../utils/companyData.jsx';
import { getContractInstance } from '../context/contracts';
import appData from '../utils/appData.jsx';
import { ethers } from 'ethers';
import { useTranslation } from 'react-i18next';

// Hook para alimentar el dashboard de Piccola Italia
const useAdminData = (appState = {}) => {
  // Extrae account, token, signTxData y sendTx del appState
  const { account = null, token = null, signTxData, sendTx } = appState || {};
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dbCollections, setDbCollections] = useState([]);
  const [dbCollectionData, setDbCollectionData] = useState([]);
  const [selectedDbCollection, setSelectedDbCollection] = useState(null);
  const { t } = useTranslation();

  // Transformar usuarios para mostrar dirección abreviada
  const formattedUsers = useMemo(() => {
    return (users || []).map((user) => ({
      ...user,
      displayAddress: user.address
        ? user.address.slice(0, 6) + '...' + user.address.slice(-4)
        : '-',
    }));
  }, [users]);

  // Obtener usuarios de Piccola Italia (company_id=1)
  const fetchUsersApi = async () => {
    setIsLoading(true);
    try {
      const res = await getCompanyUsersApi({ walletAddress: account, token });
      setUsers(res.users || []);
      appState.setSuccess(t('admin.users.updated'));
    } catch (err) {
      appState.setError(t('admin.users.error_loading'));
    } finally {
      setIsLoading(false);
    }
  };

  // Obtener el rol de un usuario en Piccola Italia
  const fetchUserRoleApi = async (targetAccount) => {
    setIsLoading(true);
    try {
      const res = await getUserRoleApi({ account: targetAccount, walletAddress: account, token });
      appState.setSuccess(t('admin.users.role_obtained'));
      return res;
    } catch (err) {
      appState.setError(t('admin.users.error_obtaining_role'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Asignar rol en Piccola Italia
  const assignCompanyRole = async ({ role_name, account: targetAccount, role_level }) => {
    setIsLoading(true);
    try {
      if (!signTxData || !sendTx || !token) {
        appState.setError(t('admin.users.error_missing_functions'));
      }
      if (!ethers.isAddress(targetAccount)) {
        appState.setError(t('admin.users.error_invalid_address'));
      }
      // Codificar la transacción
      const contract = getContractInstance('VanellixCompanyMultiToken');
      const encodedData = contract.interface.encodeFunctionData('registerCompanyUser', [1, targetAccount, role_name]);
      const plainText = `Assign ${role_name} to ${targetAccount} for company 1`;
      // Firmar datos
      const signature = await signTxData(plainText, appState);
      if (!signature) {
        appState.setError(t('admin.users.error_signing_transaction'));
      }
      // Llamar al backend
      const res = await assignCompanyRoleApi({
        role_name,
        account: targetAccount,
        role_level,
        signature,
        plain_data: plainText,
        walletAddress: account,
        token
      });
      const tx = res.tx;
      if (!tx) {
        appState.setError(t('admin.users.error_obtaining_transaction'));
      }
      // Enviar transacción on-chain
      const hash = await sendTx(tx, appState);
      if (!hash) {
        appState.setError(t('admin.users.error_sending_transaction'));
      }
      appState.setSuccess(t('admin.users.transaction_success', { hash: typeof hash === 'object' && hash !== null && hash.hash ? hash.hash : hash }), typeof hash === 'object' && hash !== null && hash.hash ? hash.hash : hash, `${appState.blockExplorer}/tx/${typeof hash === 'object' && hash !== null && hash.hash ? hash.hash : hash}`);
      // Refrescar lista de usuarios
      await fetchUsersApi();
      return hash;
    } catch (err) {
      appState.setError(t('admin.users.error_assigning_role'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Revocar rol en Piccola Italia
  const revokeCompanyRole = async (targetAccount) => {
    setIsLoading(true);
    try {
      if (!signTxData || !sendTx || !token) {
        appState.setError(t('admin.users.error_missing_functions'));
      }
      if (!ethers.isAddress(targetAccount)) {
        appState.setError(t('admin.users.error_invalid_address'));
      }
      // Codificar la transacción
      const contract = getContractInstance('VanellixCompanyMultiToken');
      const encodedData = contract.interface.encodeFunctionData('removeCompanyUser', [1, targetAccount]);
      const plainText = `Revoke role for ${targetAccount} in company 1`;
      // Firmar datos
      const signature = await signTxData(plainText, appState);
      if (!signature) {
        appState.setError(t('admin.users.error_signing_transaction'));
      }
      // Llamar al backend
      const res = await revokeCompanyRoleApi({
        account: targetAccount,
        signature,
        plain_data: plainText,
        walletAddress: account,
        token
      });
      const tx = res.tx;
      if (!tx) {
        appState.setError(t('admin.users.error_obtaining_transaction'));
      }
      // Enviar transacción on-chain
      const hash = await sendTx(tx, appState);
      if (!hash) {
        appState.setError(t('admin.users.error_sending_transaction'));
      }
      appState.setSuccess(t('admin.users.transaction_success', { hash: typeof hash === 'object' && hash !== null && hash.hash ? hash.hash : hash }), typeof hash === 'object' && hash !== null && hash.hash ? hash.hash : hash, `${appState.blockExplorer}/tx/${typeof hash === 'object' && hash !== null && hash.hash ? hash.hash : hash}`);
      // Refrescar lista de usuarios
      await fetchUsersApi();
      return hash;
    } catch (err) {
      appState.setError(t('admin.users.error_revoking_role', { targetAccount }));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };
  


  // Listar nombres de colecciones de la BD Mongo
  const fetchDbCollections = async () => {
    setIsLoading(true);
    try {
      const res = await appData.fetchDbCollections({ token, account });
      setDbCollections(res.collections || []);
      appState.setSuccess(t('admin.users.db_collections_updated'));
    } catch (err) {
      appState.setError(t('admin.users.error_loading_db_collections'));
    } finally {
      setIsLoading(false);
    }
  };


  // Traer los datos de una colección específica
  const fetchDbCollectionData = async (collectionName) => {
    if (!collectionName) return;
    setIsLoading(true);
    try {
      const res = await appData.fetchDbCollectionData({ collectionName, token, account });
      setDbCollectionData(res.data || []);
      appState.setSuccess(t('admin.users.db_collection_data_updated'));
    } catch (err) {
      appState.setError(t('admin.users.error_loading_db_collection_data'));
    } finally {
      setIsLoading(false);
    }
  };

  return {
    users: formattedUsers,
    isLoading,
    dbCollections,
    dbCollectionData,
    selectedDbCollection,
    fetchDbCollections,
    fetchDbCollectionData,
    setSelectedDbCollection,
    fetchUsersApi,
    fetchUserRoleApi,
    assignCompanyRole,
    revokeCompanyRole
  };
};

export default useAdminData;