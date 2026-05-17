import React, { useEffect, useMemo } from 'react';
import OrderDetailModal from '../../../delivery/orders/OrderDetailModal';
import useDeliveryOrders from '../../../../hooks/delivery/useDeliveryOrders';
import { useTranslation } from 'react-i18next';

export default function DeliveryOrderModal({ open, onClose, delivery, order, customerName, appState }) {
  const { t } = useTranslation();
  const {
    fetchStatuses,
    fetchLocations,
    updateOrderStatus,
    statuses,
    pickupStatuses,
    locations,
  } = useDeliveryOrders(appState, t);

  // Load configuration data on open
  useEffect(() => {
    if (open) {
      fetchStatuses();
      fetchLocations();
    }
  }, [open, fetchStatuses, fetchLocations]);

  // Build a lookup map for status keys -> status objects
  const statusesMap = useMemo(() => {
    const map = {};
    [...statuses, ...pickupStatuses].forEach((s) => {
      map[s.key] = s;
    });
    return map;
  }, [statuses, pickupStatuses]);

  if (!open) return null;

  // Handle prop mapping (can receive 'delivery' or 'order')
  const activeOrder = delivery || order;
  if (!activeOrder) return null;

  // Only roles 3, 4, 5 are allowed to edit orders in this view
  const roleLevel = appState?.companyRoleLevel ?? appState?.roleLevel ?? 0;
  const isAdmin = appState?.isAdmin === true;
  const canEdit = isAdmin || (roleLevel >= 3 && roleLevel <= 5);

  return (
    <OrderDetailModal
      isEmbedded={true}
      order={activeOrder}
      statusesMap={statusesMap}
      allStatuses={statuses}
      pickupStatuses={pickupStatuses}
      onUpdateStatus={updateOrderStatus}
      canEdit={canEdit}
      onClose={onClose}
      locations={locations}
      appState={appState}
    />
  );
}
