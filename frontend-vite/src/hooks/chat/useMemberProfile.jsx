import { useState, useEffect } from 'react';
import useCommunityActions from '../useCommunityActions';

export default function useMemberProfile({ open, member, appState }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  
  const actions = useCommunityActions(appState);

  useEffect(() => {
    if (!open || !member?.wallet) return;
    
    let isMounted = true;
    const fetchMerits = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await actions.fetchMemberMeritProfile(member.wallet, member.rut);
        if (isMounted) {
          if (res.ok !== false) {
            setData(res);
          } else {
            setError(res.error || 'No se pudo cargar el perfil');
          }
        }
      } catch (e) {
        if (isMounted) setError('Error de red al cargar el perfil');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    fetchMerits();
    return () => { isMounted = false; };
  }, [open, member?.wallet, actions.fetchMemberMeritProfile]);

  const employee = data?.employee || member;
  const totals = data?.totals || { total_points: 0 };
  const meritPoints = totals.total_points || 0;
  const level = Math.floor(meritPoints / 100) + 1;

  return { loading, error, data, employee, totals, meritPoints, level };
}
