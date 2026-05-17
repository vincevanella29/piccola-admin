import { useState, useEffect, useMemo } from 'react';
import {
  fetchCommunityCatalogs,
  fetchCommunityMembers,
} from '../../utils/communityData';

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
