import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Globe, Tag, Layers } from 'lucide-react';
import CustomSelect from '../../../../components/common/CustomSelect';
import { Field, Pill } from './shared';

const TARGET_TYPES = [
    { key: 'global', icon: Globe },
    { key: 'location', icon: MapPin },
    { key: 'category', icon: Layers },
    { key: 'dish', icon: Tag },
];

// Only add z-index and sizing — CustomSelect handles dark/light colors internally via useTheme()
const selectPortalProps = {
    menuPortalTarget: typeof document !== 'undefined' ? document.body : undefined,
    menuPosition: 'fixed',
    styles: {
        menuPortal: (base) => ({ ...base, zIndex: 99999 }),
        menu: (base) => ({ ...base, zIndex: 99999 }),
        control: (base) => ({ ...base, minHeight: 44 }),
    },
};

const TargetingTab = ({ form, setForm, locations = [], categories = [], menus = [] }) => {
    const { t } = useTranslation();
    const q = (k) => t(`banners.targeting.${k}`);

    const getProductCode = (m) => m?.codigo || m?.id || m?._id || '';

    const locationOptions = useMemo(() =>
        locations.map(l => ({ value: String(l.id || l._id), label: l.nombre })),
        [locations]);

    const categoryOptions = useMemo(() =>
        categories.map(c => ({ value: String(c.id || c._id), label: c.nombre })),
        [categories]);

    const dishOptions = useMemo(() =>
        menus.map(m => ({ value: String(getProductCode(m)), label: m.nombre })),
        [menus]);

    const targetOptions = useMemo(() => {
        if (form.target_type === 'location') return locationOptions;
        if (form.target_type === 'category') return categoryOptions;
        if (form.target_type === 'dish') return dishOptions;
        return [];
    }, [form.target_type, locationOptions, categoryOptions, dishOptions]);

    return (
        <div className="space-y-5">
            {/* Target type pills */}
            <Field label={q('type')}>
                <div className="flex flex-wrap gap-2 mt-1">
                    {TARGET_TYPES.map(({ key, icon: Icon }) => (
                        <Pill
                            key={key}
                            active={form.target_type === key}
                            onClick={() => setForm(p => ({ ...p, target_type: key, target_ids: [] }))}
                        >
                            <span className="flex items-center gap-1.5">
                                <Icon className="w-3.5 h-3.5" />
                                {q(`type_${key}`)}
                            </span>
                        </Pill>
                    ))}
                </div>
            </Field>

            {/* Target IDs selection */}
            {form.target_type !== 'global' && (
                <Field label={
                    form.target_type === 'location' ? q('select_locations') :
                    form.target_type === 'category' ? q('select_categories') :
                    q('select_dishes')
                }>
                    <div className="relative" style={{ zIndex: 60 }}>
                        <CustomSelect
                            isMulti
                            options={targetOptions}
                            value={targetOptions.filter(o => (form.target_ids || []).includes(o.value))}
                            onChange={selected => setForm(p => ({ ...p, target_ids: selected ? selected.map(o => o.value) : [] }))}
                            placeholder={q('select_placeholder')}
                            menuPlacement="auto"
                            maxMenuHeight={200}
                            {...selectPortalProps}
                        />
                    </div>
                </Field>
            )}

            {/* Location targeting (where to show banner) */}
            <Field label={q('locations')} hint={q('locations_hint')}>
                <div className="relative" style={{ zIndex: 50 }}>
                    <CustomSelect
                        isMulti
                        options={locationOptions}
                        value={locationOptions.filter(o => (form.location_ids || []).includes(o.value))}
                        onChange={selected => setForm(p => ({ ...p, location_ids: selected ? selected.map(o => o.value) : [] }))}
                        placeholder={q('select_placeholder')}
                        menuPlacement="auto"
                        maxMenuHeight={200}
                        {...selectPortalProps}
                    />
                </div>
            </Field>
        </div>
    );
};

export default TargetingTab;
