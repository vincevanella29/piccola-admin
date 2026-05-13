import { useState, useEffect, useCallback } from 'react';
import useCommunityActions from '../useCommunityActions';

export default function useSectionPerms({ open, token, walletAddress, appState }) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(null);
  const [activeSection, setActiveSection] = useState(null);

  const actions = useCommunityActions(appState);

  useEffect(() => {
    if (!open || !token) return;
    setLoading(true);
    actions.fetchSectionPerms()
      .then(res => {
        const data = res?.sections || res?.data?.sections || [];
        setSections(data);
        if (data.length > 0 && !activeSection) {
          setActiveSection(data[0].seccion);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, token, walletAddress, activeSection, actions]);

  const handleToggle = useCallback(async (seccion, field, newValue) => {
    setSections(prev => prev.map(s =>
      s.seccion === seccion ? { ...s, [field]: newValue } : s
    ));
    setSaving(seccion);
    try {
      await actions.updateSectionPerms(seccion, { [field]: newValue });
    } catch (e) {
      setSections(prev => prev.map(s =>
        s.seccion === seccion ? { ...s, [field]: !newValue } : s
      ));
    } finally {
      setSaving(null);
    }
  }, [actions]);

  const handleMaxGroups = useCallback(async (seccion, newVal) => {
    const num = Math.max(0, Math.min(50, parseInt(newVal) || 0));
    setSections(prev => prev.map(s =>
      s.seccion === seccion ? { ...s, max_groups: num } : s
    ));
    setSaving(seccion);
    try {
      await actions.updateSectionPerms(seccion, { max_groups: num });
    } catch {
    } finally {
      setSaving(null);
    }
  }, [actions]);

  const currentSection = sections.find(s => s.seccion === activeSection);

  return {
    sections,
    loading,
    saving,
    activeSection,
    setActiveSection,
    currentSection,
    handleToggle,
    handleMaxGroups,
  };
}
