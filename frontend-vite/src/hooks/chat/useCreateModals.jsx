import { useState, useEffect, useMemo } from 'react';
import {
  fetchSuggestedChannels,
  createChannel,
  fetchCommunityCatalogs,
  fetchCommunityMembers,
} from '../../utils/communityData';

export function useCreateChannelModal({ open, token, walletAddress, onCreated, onClose }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('text');
  const [section, setSection] = useState(null);
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [minRole, setMinRole] = useState(6);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [catalogs, setCatalogs] = useState({ cargos: [], secciones: [] });

  useEffect(() => {
    if (!open || !token) return;
    fetchSuggestedChannels({ token, walletAddress })
      .then(s => setSuggestions(Array.isArray(s) ? s : []))
      .catch(() => {});
    fetchCommunityCatalogs({ token, walletAddress })
      .then(res => setCatalogs({
        cargos: res?.cargos || res?.data?.cargos || [],
        secciones: res?.secciones || res?.data?.secciones || [],
      }))
      .catch(() => {});
  }, [open, token, walletAddress]);

  const applySuggestion = (s) => {
    setName(s.name);
    setSection(s.section_filter || null);
    setDescription(s.description || '');
    setIcon(s.icon || '');
    setType(s.channel_type || 'text');
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await createChannel({
        token, walletAddress,
        data: { name, channel_type: type, section_filter: section || null, description, icon, min_role_level: minRole },
      });
      onCreated?.();
      onClose();
    } catch (e) {
      alert(e?.message || 'Error al crear canal');
    } finally {
      setLoading(false);
    }
  };

  return {
    name, setName,
    type, setType,
    section, setSection,
    description, setDescription,
    icon, setIcon,
    minRole, setMinRole,
    loading,
    suggestions,
    catalogs,
    applySuggestion,
    handleCreate
  };
}

export function useDmPickerModal({ open, token, walletAddress }) {
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState(null);
  const [catalogs, setCatalogs] = useState({ cargos: [], secciones: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !token) return;
    fetchCommunityCatalogs({ token, walletAddress })
      .then(res => setCatalogs({
        cargos: res?.cargos || res?.data?.cargos || [],
        secciones: res?.secciones || res?.data?.secciones || [],
      }))
      .catch(() => {});
  }, [open, token, walletAddress]);

  useEffect(() => {
    if (!open || !token) return;
    setLoading(true);
    const delay = setTimeout(() => {
      fetchCommunityMembers({ token, walletAddress, q: search, limit: 20 })
        .then(res => {
          const list = Array.isArray(res) ? res : (res?.members || []);
          // filter out self
          setMembers(list.filter(m => m.wallet?.toLowerCase() !== walletAddress?.toLowerCase()));
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 400);
    return () => clearTimeout(delay);
  }, [open, token, walletAddress, search]);

  const filteredMembers = useMemo(() => {
    if (!sectionFilter) return members;
    return members.filter(m => m.seccion === sectionFilter);
  }, [members, sectionFilter]);

  return {
    members: filteredMembers,
    search, setSearch,
    sectionFilter, setSectionFilter,
    catalogs,
    loading
  };
}
