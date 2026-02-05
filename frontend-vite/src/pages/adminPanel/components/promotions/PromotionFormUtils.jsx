// src/components/promotions/PromotionFormUtils.jsx
import { isAddress } from 'ethers';

export const initialFormData = {
  status: true,
  name: '',
  description: '',
  reward_type: 'discount',
  promotion_type: 'D',
  reward_details: { discount: 0, type: 'percentage' },
  menu_item_skus: [],
  display: {
    start: '',
    end: '',
    days: [],
    from_time: '',
    to_time: '',
    excluded_dates: [],
  },
  claim: {
    start: '',
    end: '',
    days: [],
    from_time: '',
    to_time: '',
    excluded_dates: [],
  },
  redeem: {
    validity: 'period',
    valid_from: '',
    valid_until: '',
    days: [],
    from_time: '',
    to_time: '',
    excluded_dates: [],
    birthday_validity_days: 1,
  },
  max_coupon_per_table: 1,
  max_coupon_per_promo: 100,
  max_claims: 5,
  max_claims_per_day: null,
  locations: [],
  is_birthday_coupon: false,
  rules: [],
};

export const handleChange = (e, setFormData, setFormError, section = null, key = null, ruleIndex = null) => {
  let name, value, type, checked;
  if (e && e.target) {
    ({ name, value, type, checked } = e.target);
  } else if (e && typeof e === 'object') {
    ({ name, value, type, checked } = e);
  }
  setFormError?.(null);
  setFormData((prev) => {
    if (ruleIndex !== null && key) {
      const updatedRules = [...prev.rules];
      updatedRules[ruleIndex] = { ...updatedRules[ruleIndex], [key]: type === 'number' ? parseFloat(value) || 0 : value };
      return { ...prev, rules: updatedRules };
    }
    if (section && key) {
      return {
        ...prev,
        [section]: {
          ...prev[section],
          [key]: type === 'checkbox' ? checked : value,
        },
      };
    }
    if (name && typeof name === 'string' && name.includes('.')) {
      const [parent, child] = name.split('.');
      return {
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: type === 'number' ? parseFloat(value) || 0 : value,
        },
      };
    }
    if (name && typeof name === 'string') {
      return {
        ...prev,
        [name]: type === 'checkbox' ? checked : type === 'number' ? parseFloat(value) || 0 : value,
      };
    }
    if (e && typeof e === 'object' && e.name && e.value !== undefined) {
      return {
        ...prev,
        [e.name]: e.value,
      };
    }
    return prev;
  });
};

export const handleSelectChange = (selected, setFormData, setFormError, section, subfield = null, rules = null) => {
  setFormError(null);
  setFormData((prev) => {
    if (rules) {
      return { ...prev, rules };
    }
    return {
      ...prev,
      [section]: subfield
        ? { ...prev[section], [subfield]: selected ? selected.map((item) => item.value) : [] }
        : selected ? selected.map((item) => item.value) : [],
      status: prev.status,
    };
  });
};

export const addExcludedDate = (setFormData, section) => {
  setFormData((prev) => ({
    ...prev,
    [section]: {
      ...prev[section],
      excluded_dates: [...prev[section].excluded_dates, ''],
    },
  }));
};

export const removeExcludedDate = (setFormData, section, index) => {
  setFormData((prev) => {
    const newExcludedDates = [...prev[section].excluded_dates].filter((_, i) => i !== index);
    return {
      ...prev,
      [section]: {
        ...prev[section],
        excluded_dates: newExcludedDates,
      },
    };
  });
};

export const updateExcludedDate = (setFormData, section, index, value) => {
  setFormData((prev) => ({
    ...prev,
    [section]: {
      ...prev[section],
      excluded_dates: prev[section].excluded_dates.map((d, i) =>
        i === index ? value : d
      ),
    },
  }));
};

export const handleBirthdayToggle = (e, setFormData) => {
  const checked = e.target.checked;
  setFormData((prev) => ({
    ...prev,
    is_birthday_coupon: checked,
    redeem: {
      ...prev.redeem,
      validity: checked ? 'birthday' : 'period',
    },
  }));
};

export const handleValidityChange = (e, setFormData, section) => {
  const { value } = e.target;
  setFormData((prev) => ({
    ...prev,
    [section]: {
      ...prev[section],
      validity: value,
      valid_from: value === 'forever' ? '' : prev[section].valid_from,
      valid_until: value === 'forever' ? '' : prev[section].valid_until,
    },
  }));
};

export const validateForm = (formData, t) => {
  if (!formData.name) return t('promotion.incomplete');
  if (!formData.description) return t('promotion.incomplete');
  if (formData.reward_type === 'discount' && formData.promotion_type !== 'D') return t('promotion.invalid_promotion_type_discount');
  if (formData.reward_type === 'product' && formData.promotion_type !== 'P') return t('promotion.invalid_promotion_type_product');
  if (formData.reward_type === 'product' && (!Array.isArray(formData.menu_item_skus) || formData.menu_item_skus.length === 0)) {
    return t('promotion.missing_sku');
  }
  if (formData.reward_type === 'discount' && formData.menu_item_skus.length > 0) return t('promotion.invalid_menu_skus_discount');
  if ((formData.reward_type === 'discount' || formData.reward_type === 'product') && formData.reward_details.discount <= 0) {
    return t('promotion.invalid_discount');
  }
  if (!formData.display.start || !formData.display.end) return t('promotion.invalid_display_dates');
  if (new Date(formData.display.start) > new Date(formData.display.end)) return t('promotion.invalid_display_dates');
  if (!formData.claim.start || !formData.claim.end) return t('promotion.invalid_claim_dates');
  if (new Date(formData.claim.start) > new Date(formData.claim.end)) return t('promotion.invalid_claim_dates');
  const displayStart = new Date(formData.display.start);
  const displayEnd = new Date(formData.display.end);
  const claimStart = new Date(formData.claim.start);
  const claimEnd = new Date(formData.claim.end);
  if (displayStart > claimStart) return t('promotion.display_before_claim');
  if (claimStart < displayStart || claimEnd > displayEnd) return t('promotion.claim_within_display');
  if (formData.is_birthday_coupon && formData.redeem.validity !== 'birthday') return t('promotion.invalid_birthday_validity');
  if (!formData.is_birthday_coupon && (formData.redeem.validity === 'fixed' || formData.redeem.validity === 'period')) {
    if (!formData.redeem.valid_from || !formData.redeem.valid_until) return t('promotion.invalid_redeem_dates');
    if (new Date(formData.redeem.valid_from) >= new Date(formData.redeem.valid_until)) return t('promotion.invalid_redeem_dates');
  }
  const burnRules = formData.rules.filter((rule) => rule.rule_type === 'burn_tokens');
  if (burnRules.length > 1) return t('promotion.rules.max_one_burn_rule');
  if (formData.rules.length > 0) {
    for (const rule of formData.rules) {
      if (rule.rule_type === 'hold_tokens' || rule.rule_type === 'burn_tokens') {
        if (!rule.token_address || !isAddress(rule.token_address) || rule.amount <= 0) {
          return t('promotion.invalid_token_rule');
        }
      } else if (rule.rule_type === 'require_min_liked_products') {
        if (!rule.min_count || rule.min_count <= 0) {
          return t('promotion.invalid_token_rule');
        }
      } else if (rule.rule_type === 'merit_min_wallet') {
        if (!rule.segment_token_id || rule.amount <= 0) {
          return t('promotion.invalid_merit_rule');
        }
      } else if (rule.rule_type === 'merit_rule_fulfilled') {
        if (!rule.merit_rule_name || !rule.ranking_period) {
          return t('promotion.invalid_merit_rule');
        }
      }
    }
  }
  return null;
};

export const preparePromotionData = (formData, isUpdate, tokenDecimals) => {
  const promotionData = { ...formData };
  promotionData.status = formData.status;
  promotionData.name = formData.name;
  promotionData.description = formData.description;
  promotionData.reward_type = formData.reward_type;
  promotionData.promotion_type = formData.promotion_type;
  if (formData.reward_type === 'discount' || formData.reward_type === 'product') {
    promotionData.reward_details = {
      discount: formData.reward_details?.discount ?? (formData.reward_type === 'product' ? 100 : 0),
      type: formData.reward_details?.type ?? 'percentage',
    };
  } else {
    promotionData.reward_details = {};
  }
  promotionData.menu_item_skus = formData.reward_type === 'product' ? formData.menu_item_skus : [];
  promotionData.display_start = formData.display.start;
  promotionData.display_end = formData.display.end;
  promotionData.display_recurring_every = formData.display.days;
  promotionData.display_from_time = formData.display.from_time;
  promotionData.display_to_time = formData.display.to_time;
  promotionData.display_excluded_dates = formData.display.excluded_dates.filter((date) => date);
  promotionData.claim_start = formData.claim.start;
  promotionData.claim_end = formData.claim.end;
  promotionData.claim_recurring_every = formData.claim.days;
  promotionData.claim_from_time = formData.claim.from_time;
  promotionData.claim_to_time = formData.claim.to_time;
  promotionData.claim_excluded_dates = formData.claim.excluded_dates.filter((date) => date);
  promotionData.coupon_validity = {
    validity: formData.redeem.validity,
    valid_from: formData.redeem.valid_from || null,
    valid_until: formData.redeem.valid_until || null,
    recurring_every: formData.redeem.days,
    recurring_from_time: formData.redeem.from_time,
    recurring_to_time: formData.redeem.to_time,
    excluded_dates: formData.redeem.excluded_dates.filter((date) => date),
    birthday_valid_days: formData.is_birthday_coupon ? formData.redeem.birthday_validity_days : null,
  };
  promotionData.max_coupon_per_table = formData.max_coupon_per_table;
  promotionData.max_coupon_per_promo = formData.max_coupon_per_promo;
  promotionData.max_claims = formData.max_claims;
  promotionData.max_claims_per_day = formData.max_claims_per_day || null;
  promotionData.locations = formData.locations;
  promotionData.is_birthday_coupon = formData.is_birthday_coupon;

  // Normalizar reglas antes de enviar al backend
  promotionData.rules = (formData.rules || []).map((rule) => {
    if (rule.rule_type === 'merit_min_wallet') {
      const raw = Number(rule.amount || 0);
      // Interpretamos el valor ingresado como puntos "humanos" y lo convertimos a base units (18 decimales)
      const wholePoints = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
      const scaled = BigInt(wholePoints) * (10n ** 18n);
      return {
        ...rule,
        amount: scaled.toString(),
      };
    }
    return rule;
  });

  if (!isUpdate) {
    delete promotionData.status;
  }

  return promotionData;
};

export const customSelectStyles = {
  control: (provided, state) => ({
    ...provided,
    backgroundColor: 'var(--surface-secondary)',
    borderColor: 'var(--border)',
    borderRadius: '0.75rem',
    padding: '0.25rem',
    boxShadow: state.isFocused ? '0 0 10px rgba(var(--matrix-green-rgb), 0.2)' : 'none',
    color: 'var(--text-primary)',
    '&:hover': {
      borderColor: 'var(--border)',
    },
  }),
  input: (provided) => ({
    ...provided,
    color: 'var(--text-primary)',
  }),
  singleValue: (provided) => ({
    ...provided,
    color: 'var(--text-primary)',
  }),
  multiValue: (provided) => ({
    ...provided,
    backgroundColor: 'rgba(var(--matrix-green-rgb), 0.5)',
    borderRadius: '0.5rem',
  }),
  multiValueLabel: (provided) => ({
    ...provided,
    color: 'var(--text-primary)',
  }),
  multiValueRemove: (provided) => ({
    ...provided,
    color: 'var(--text-primary)',
    '&:hover': {
      backgroundColor: 'rgba(var(--vanellix-purple-rgb), 0.5)',
      color: 'var(--text-primary)',
    },
  }),
  menu: (provided) => ({
    ...provided,
    backgroundColor: 'var(--surface-secondary, var(--surface))',
    borderRadius: '0.75rem',
    backdropFilter: 'blur(10px)',
    zIndex: 9999,
  }),
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isSelected
      ? 'rgba(var(--matrix-green-rgb), 0.3)'
      : state.isFocused
        ? 'rgba(var(--matrix-green-rgb), 0.2)'
        : 'transparent',
    color: 'var(--text-primary)',
    '&:hover': {
      backgroundColor: 'rgba(var(--matrix-green-rgb), 0.2)',
    },
  }),
  placeholder: (provided) => ({
    ...provided,
    color: 'var(--text-secondary)',
  }),
};