import { useTranslation } from 'react-i18next';

export const normalizeLocationsApiResponse = (response) => {
  if (Array.isArray(response)) return response;
  if (response && Array.isArray(response.locations)) return response.locations;
  return [];
};

export const getCurrentPrice = (dish, restriction = 'dinein', chileTime = null, t) => {
  const now = chileTime || new Date();
  const special = dish.especial;
  const restricciones = dish.restriccion || [];
  const isRestrictionOk = restricciones.includes(restriction);

  if (
    special?.special_status &&
    isRestrictionOk &&
    (special.validity === 'forever' || special.validity === 'recurring')
  ) {
    if (special.validity === 'recurring') {
      const day = now.getDay() === 0 ? 7 : now.getDay();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const currentTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
      const isWithinTime = special.recurring_from <= currentTime && currentTime <= special.recurring_to;
      const isRecurringDay = special.recurring_every?.includes(String(day));
      if (isWithinTime && isRecurringDay) {
        return {
          price: special.special_price,
          isSpecial: true,
          schedule: `${special.recurring_from} - ${special.recurring_to} (${special.recurring_every.map(day => t(`common.day_${day}`)).join(', ')})`,
        };
      }
    } else {
      return {
        price: special.special_price,
        isSpecial: true,
        schedule: t('common.forever_offer'),
      };
    }
  }
  return {
    price: dish.precio,
    isSpecial: false,
    schedule: null,
  };
};

export const truncateDescription = (desc, maxLen) => {
  if (!desc) return '';
  return desc.length > maxLen ? desc.slice(0, maxLen) + '...' : desc;
};