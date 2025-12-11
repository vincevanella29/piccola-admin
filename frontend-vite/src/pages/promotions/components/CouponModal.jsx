import React from 'react';
import { motion } from 'framer-motion';
import { FaTimes, FaCalendarAlt, FaClock, FaMapMarkerAlt, FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaHistory } from 'react-icons/fa';
import QRCode from 'react-qr-code';
import CountdownTimer from './CountdownTimer';
import InfoTooltip from '../../../components/common/Tools/InfoTooltip';
import { getDiscountText } from './PromotionCard';

const CouponModal = ({ coupon, onClose, t, profile }) => {
  // Formatter for Chile time
  const chileFormatter = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });

  const chileTimeString = chileFormatter.format(new Date());

  // Get date parts in Chile time
  const partsFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = partsFormatter.formatToParts(new Date());
  const partMap = parts.reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  const year = parseInt(partMap.year);
  const month = parseInt(partMap.month) - 1;
  const day = parseInt(partMap.day);
  const currentHour = parseInt(partMap.hour);
  const currentMinute = parseInt(partMap.minute);
  const currentTimeMinutes = currentHour * 60 + currentMinute;

  // Get day of week (lowercase)
  const dayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'America/Santiago' });
  const dayOfWeek = dayFormatter.format(new Date()).toLowerCase();

  // Current date string 'YYYY-MM-DD'
  const currentDateStr = `${year.toString().padStart(4, '0')}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

  const promotion = coupon.promotion;
  const validity = promotion.coupon_validity;
  let isValidNow = true;
  let validityMessage = [];
  let countdownTarget = null;
  let expirationTarget = null;
  let startDateTime = null;
  let endDateTime = null;
  let missingBirthdate = false;

  if (validity.validity === 'birthday') {
    if (!profile || !profile.birthdate) {
      isValidNow = false;
      validityMessage.push(t('promotion-front.birthday_missing_msg'));
      missingBirthdate = true;
    } else {
      const now = new Date();
      const [_, bMonth, bDay] = profile.birthdate.split('-').map(Number);
      const thisBday = new Date(now.getFullYear(), bMonth - 1, bDay);
      const startThis = new Date(thisBday);
      startThis.setDate(startThis.getDate() - validity.birthday_valid_days);
      startThis.setHours(0, 0, 0, 0);
      const endThis = new Date(thisBday);
      endThis.setDate(endThis.getDate() + validity.birthday_valid_days);
      endThis.setHours(23, 59, 59, 999);

      if (now >= startThis && now <= endThis) {
        startDateTime = startThis;
        endDateTime = endThis;
      } else if (now < startThis) {
        startDateTime = startThis;
        endDateTime = endThis;
      } else {
        const nextBday = new Date(now.getFullYear() + 1, bMonth - 1, bDay);
        startDateTime = new Date(nextBday);
        startDateTime.setDate(startDateTime.getDate() - validity.birthday_valid_days);
        startDateTime.setHours(0, 0, 0, 0);
        endDateTime = new Date(nextBday);
        endDateTime.setDate(endDateTime.getDate() + validity.birthday_valid_days);
        endDateTime.setHours(23, 59, 59, 999);
      }
      validityMessage.push(`${t('promotion-front.from')} ${startDateTime.toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })} ${t('promotion-front.until')} ${endDateTime.toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })}`);
      if (now < startDateTime) {
        isValidNow = false;
        countdownTarget = startDateTime;
      } else if (now > endDateTime) {
        isValidNow = false;
      } else {
        isValidNow = true;
        expirationTarget = endDateTime;
      }
    }
  } else {
    // Check date range if applicable
    if (validity.valid_from) {
      startDateTime = new Date(validity.valid_from);
      if (new Date() < startDateTime) {
        isValidNow = false;
        countdownTarget = startDateTime;
      }
      validityMessage.push(`${t('promotion-front.from')} ${startDateTime.toLocaleString('es-CL', { timeZone: 'America/Santiago' })}`);
    }
    if (validity.valid_until) {
      endDateTime = new Date(validity.valid_until);
      if (new Date() > endDateTime) {
        isValidNow = false;
      } else if (isValidNow) {
        expirationTarget = endDateTime;
      }
      validityMessage.push(`${t('promotion-front.until')} ${endDateTime.toLocaleString('es-CL', { timeZone: 'America/Santiago' })}`);
    }
  }

  // Check excluded dates first
  if (validity.excluded_dates.includes(currentDateStr)) {
    isValidNow = false;
    validityMessage.push(t('promotion-front.excluded_today'));
  }

  // Check recurring days
  const hasRecurringDays = validity.recurring_every.length > 0;
  if (hasRecurringDays && !validity.recurring_every.includes(dayOfWeek)) {
    isValidNow = false;
  }
  if (hasRecurringDays) {
    validityMessage.push(validity.recurring_every.map((d) => t(`days.${d}`)).join(', '));
  } else if (validity.validity === 'recurring' || validity.validity === 'forever') {
    validityMessage.push(t('promotion-front.all_days'));
  }

  // Check recurring time
  const fromTimeMinutes = validity.recurring_from_time ? parseTime(validity.recurring_from_time) : 0;
  const toTimeMinutes = validity.recurring_to_time ? parseTime(validity.recurring_to_time) : 1439;
  const hasTimeRange = validity.recurring_from_time || validity.recurring_to_time;
  if (hasTimeRange && (currentTimeMinutes < fromTimeMinutes || currentTimeMinutes > toTimeMinutes)) {
    isValidNow = false;
  }
  if (hasTimeRange) {
    validityMessage.push(
      `${validity.recurring_from_time || t('promotion-front.from_opening')} - ${
        validity.recurring_to_time || t('promotion-front.to_closing')
      }`,
    );
  }

  // Calculate countdown if not valid now
  if (!isValidNow && !missingBirthdate) {
    if (validity.validity !== 'birthday' || countdownTarget === null) {
      countdownTarget = findNextValidTime(validity, year, month, day, currentTimeMinutes, dayOfWeek);
    }
  } else if (isValidNow) {
    expirationTarget = findEndTime(validity, year, month, day, currentTimeMinutes, dayOfWeek);
  }

  // Locations
  const validLocations = promotion.locations.length === 0 ? t('promotion-front.all_locations') : promotion.locations.join(', ');

  // Discount animation if discount and no image
  let discountContent = null;
  if ((promotion.reward_type === 'discount' || promotion.promotion_type === 'P') && !coupon.menu_item?.media_r2) {
    const discountText = getDiscountText(promotion, t);
    let amount, mainText;
    const { discount, type } = promotion.reward_details || {};
    if (type === 'fixed') {
      amount = `$${discount?.toLocaleString('es-CL') || 0}`;
      mainText = t('promotion-front.discount_fixed', { amount: '' }).replace(' {{amount}}', '').trim();
    } else if (type === 'percentage') {
      amount = `${discount || 0}%`;
      mainText = t('promotion-front.off_bill');
    } else {
      amount = '';
      mainText = discountText || t('promotion-front.no_discount');
    }
    discountContent = (
      <div className="w-full h-48 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-xl mb-4 flex flex-col items-center justify-center overflow-hidden relative border-2 border-matrix-green shadow-neon-green">
        <motion.span
          className="text-6xl font-bold text-matrix-green z-10"
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          {amount}
        </motion.span>
        <span className="text-xl text-matrix-green z-10 text-center px-4">{mainText}</span>
      </div>
    );
  }

  function parseTime(timeStr) {
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    return hours * 60 + minutes + (seconds ? seconds / 60 : 0);
  }

  function findNextValidTime(validity, y, m, d, currentMin, currentDow) {
    let targetDate = new Date(y, m, d);
    let targetMin = fromTimeMinutes;

    // If in range but before time, or not in day
    if (hasTimeRange && currentMin < fromTimeMinutes && (!hasRecurringDays || validity.recurring_every.includes(currentDow))) {
      // Today, at from time
      return new Date(y, m, d, Math.floor(fromTimeMinutes / 60), fromTimeMinutes % 60, 0);
    }

    // Next day
    targetDate.setDate(targetDate.getDate() + 1);

    // Find next valid day if recurring days
    if (hasRecurringDays) {
      let dowNum = targetDate.getDay();
      const daysMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
      const validNums = validity.recurring_every.map((d) => daysMap[d]);
      while (!validNums.includes(dowNum)) {
        targetDate.setDate(targetDate.getDate() + 1);
        dowNum = targetDate.getDay();
      }
    }

    // Skip excluded
    let targetDateStr = targetDate.toISOString().split('T')[0];
    while (validity.excluded_dates.includes(targetDateStr)) {
      targetDate.setDate(targetDate.getDate() + 1);
      targetDateStr = targetDate.toISOString().split('T')[0];
    }

    // Check start date
    if (startDateTime && targetDate < startDateTime) {
      targetDate = new Date(startDateTime);
    }

    return new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), Math.floor(targetMin / 60), targetMin % 60, 0);
  }

  function findEndTime(validity, y, m, d, currentMin, currentDow) {
    let targetMin = toTimeMinutes;
    let targetDate = new Date(y, m, d);

    if (endDateTime) {
      return endDateTime;
    } else if (hasTimeRange) {
      return new Date(y, m, d, Math.floor(targetMin / 60), targetMin % 60, 0);
    } else {
      // End of day
      return new Date(y, m, d, 23, 59, 59);
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="relative bg-light-surface/95 dark:bg-dark-surface/95 rounded-2xl shadow-2xl w-full max-w-lg mx-auto max-h-[calc(90vh-8rem)] flex flex-col border border-matrix-green/20 shadow-neon"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3, type: 'spring' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-light-surface/95 dark:bg-dark-surface/95 backdrop-blur-sm px-6 py-4 flex items-center justify-between border-b border-light-border/20 dark:border-dark-border/20 rounded-t-2xl">
          <h2 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary truncate">
            {coupon.promotion.name}
          </h2>
          <button
            onClick={onClose}
            className="text-light-text-secondary dark:text-dark-text-secondary hover:text-vanellix-purple transition-colors flex-shrink-0"
            title={t('promotion-front.close')}
          >
            <FaTimes size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="flex flex-col items-center">
            <QRCode value={coupon.coupon_code} size={128} className="bg-white p-2 rounded-lg shadow-neon mb-2" />
            <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1 mb-2">
              {t('promotion-front.scan_qr')} <InfoTooltip text={t('promotion-front.scan_qr_tooltip')} />
            </div>
            <p className="text-center font-bold text-md mb-4">{coupon.coupon_code}</p>
          </div>
          {discountContent}
          {coupon.menu_item?.media_r2 && (
            <img
              src={coupon.menu_item.media_r2}
              alt={coupon.menu_item.nombre}
              className="w-full max-h-48 object-cover rounded-xl mb-4 shadow-neon"
            />
          )}
          <p className="text-light-text-secondary dark:text-dark-text-secondary text-center">{coupon.promotion.description}</p>
          {coupon.menu_item && (
            <>
              <h3 className="text-lg font-bold text-center text-light-text-primary dark:text-dark-text-primary">{coupon.menu_item.nombre}</h3>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary text-center mb-4">{coupon.menu_item.descripcion}</p>
            </>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-light-text-primary dark:text-dark-text-primary text-sm">
              <FaClock className="text-vanellix-cyan" /> <strong>{t('promotion-front.chile_time')}:</strong> {chileTimeString}
              <InfoTooltip text={t('promotion-front.chile_time_tooltip')} />
            </div>
            <div className="flex items-center justify-center gap-2 text-light-text-primary dark:text-dark-text-primary text-sm">
              <FaCalendarAlt className="text-vanellix-cyan" /> <strong>{t('promotion-front.claimed_at')}:</strong>{' '}
              {new Date(coupon.timestamp).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}
              <InfoTooltip text={t('promotion-front.claimed_at_tooltip')} />
            </div>
            <div className="flex items-center justify-center gap-2 text-light-text-primary dark:text-dark-text-primary text-sm">
              <FaMapMarkerAlt className="text-vanellix-cyan" /> <strong>{t('promotion-front.valid_locations')}:</strong> {validLocations}
              <InfoTooltip text={t('promotion-front.locations_tooltip')} />
            </div>
            <div className="flex items-center justify-center gap-2 text-light-text-primary dark:text-dark-text-primary text-sm flex-wrap">
              <FaInfoCircle className="text-vanellix-cyan" /> <strong>{t('promotion-front.validity')}:</strong> {validityMessage.join(', ')}
              <InfoTooltip text={t('promotion-front.validity_tooltip')} />
            </div>
          </div>
          {missingBirthdate && (
            <div className="text-center text-red-500">
              <p>{t('promotion-front.birthday_missing_title')}</p>
              {/* Could add a link to profile, but since modal, perhaps not */}
            </div>
          )}
          <div className={`flex justify-center items-center gap-2 font-bold ${isValidNow ? 'text-matrix-green' : 'text-vanellix-purple'}`}>
            {isValidNow ? <FaCheckCircle /> : <FaExclamationTriangle />} {isValidNow ? t('promotion-front.valid_now') : t('promotion-front.not_valid_now')}
            <InfoTooltip text={isValidNow ? t('promotion-front.valid_now_tooltip') : t('promotion-front.not_valid_now_tooltip')} />
          </div>
          {(countdownTarget || expirationTarget) && (
            <div className="flex justify-center">
              <CountdownTimer 
                targetDate={countdownTarget || expirationTarget} 
                label={countdownTarget ? t('promotion-front.starts_in') : t('promotion-front.ends_in')}
              />
            </div>
          )}
          {coupon.history.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-2 flex items-center justify-center gap-2">
                <FaHistory className="text-matrix-green" /> {t('promotion-front.history')}
                <InfoTooltip text={t('promotion-front.history_tooltip')} />
              </h4>
              <ul className="space-y-2">
                {coupon.history.map((entry, idx) => (
                  <li
                    key={idx}
                    className="bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 p-2 rounded-lg flex items-center gap-2 text-xs text-light-text-primary dark:text-dark-text-primary"
                  >
                    <FaCheckCircle className="text-green-500 flex-shrink-0" />
                    {t(`promotion-front.history_${entry.action === '' ? 'redeemed' : entry.action}`)} {new Date(entry.timestamp).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}
                    {entry.discount_amount ? `(${entry.discount_amount})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CouponModal;