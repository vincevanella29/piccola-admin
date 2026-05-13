import { useState, useEffect } from 'react';
import useCommunityActions from '../useCommunityActions';

export default function useGroupModal({ open, group, token, walletAddress, isAdmin, onUpdated, onClose, appState }) {
  const isEditMode = !!group;
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // General state
  const [name, setName] = useState(group?.name || '');
  const [icon, setIcon] = useState(group?.icon || '');
  const [isSectionBased, setIsSectionBased] = useState(group?.is_section_based || false);
  const [allowedSecciones, setAllowedSecciones] = useState(group?.allowed_secciones || []);
  const [allowedCargos, setAllowedCargos] = useState(group?.allowed_cargos || []);

  // Catalogs
  const [secciones, setSecciones] = useState([]);
  const [cargos, setCargos] = useState([]);

  // Local members state
  const [members, setMembers] = useState(group?.members || []);

  const actions = useCommunityActions(appState);

  useEffect(() => {
    async function loadCatalogs() {
      if (!open || !token) return;
      try {
        const res = await actions.fetchCatalogs();
        if (res && res.ok !== false) {
          setSecciones(res.secciones || []);
          setCargos(res.cargos || []);
        }
      } catch (e) {
        console.error('Failed to load catalogs', e);
      }
    }
    loadCatalogs();
  }, [open, token, actions]);

  const safeWallet = (walletAddress || '').toLowerCase();
  const isOwner = isEditMode && group?.owner_wallet?.toLowerCase() === safeWallet;
  const myRole = isEditMode ? members.find(m => m.wallet?.toLowerCase() === safeWallet)?.role || 'member' : 'owner';
  const isMod = myRole === 'mod';
  const canManageRoles = isAdmin || isOwner;
  const canKick = isAdmin || isOwner || isMod;

  const handleSaveGeneral = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        icon: icon.trim(),
        is_section_based: isSectionBased,
        allowed_secciones: isSectionBased ? allowedSecciones : [],
        allowed_cargos: isSectionBased ? allowedCargos : [],
      };

      if (isEditMode) {
        await actions.updateGroup(group.group_id, payload);
      } else {
        await actions.createGroup(payload);
      }
      onUpdated?.();
      onClose();
    } catch (e) {
      console.error(e);
      setError(isEditMode ? 'Error al actualizar grupo' : 'Error al crear grupo');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (targetWallet, newRole) => {
    if (!canManageRoles || !isEditMode) return;
    setLoading(true);
    try {
      await actions.updateGroupMemberRole(group.group_id, targetWallet, newRole);
      setMembers(prev => prev.map(m => m.wallet === targetWallet ? { ...m, role: newRole } : m));
      onUpdated?.();
    } catch (e) {
      console.error(e);
      setError('Error al cambiar rol');
    } finally {
      setLoading(false);
    }
  };

  const handleKick = async (targetWallet) => {
    if (!canKick || !isEditMode) return;
    setLoading(true);
    try {
      await actions.removeGroupMember(group.group_id, targetWallet);
      setMembers(prev => prev.filter(m => m.wallet !== targetWallet));
      onUpdated?.();
    } catch (e) {
      console.error(e);
      setError('Error al expulsar miembro');
    } finally {
      setLoading(false);
    }
  };

  const toggleSeccion = (sec) => {
    setAllowedSecciones(prev => prev.includes(sec) ? prev.filter(s => s !== sec) : [...prev, sec]);
  };

  const toggleCargo = (car) => {
    setAllowedCargos(prev => prev.includes(car) ? prev.filter(c => c !== car) : [...prev, car]);
  };

  return {
    isEditMode,
    activeTab, setActiveTab,
    loading, error,
    name, setName,
    icon, setIcon,
    isSectionBased, setIsSectionBased,
    allowedSecciones, setAllowedSecciones,
    allowedCargos, setAllowedCargos,
    secciones, cargos,
    members,
    isOwner, myRole, isMod, canManageRoles, canKick,
    handleSaveGeneral, handleRoleChange, handleKick,
    toggleSeccion, toggleCargo
  };
}
