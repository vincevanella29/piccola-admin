import React from "react";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useTranslation } from "react-i18next";
import { enUS, es, it, ptBR } from "date-fns/locale";

const localeMap = { en: enUS, es, it, pt: ptBR };

function isSameDay(a, b) {
  if (!(a instanceof Date) || !(b instanceof Date)) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * DatePickerTheme (glass/futurista)
 * - Tailwind-only styling (light/dark)
 * - Transparencias + blur + anillos de enfoque
 */
const DatePickerTheme = ({
  value,
  onChange,
  label,
  className = "",
  minDate,
  maxDate,
  placeholderText,
  disabled,
  ...props
}) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.split("-")[0] || "es";
  const locale = localeMap[lang] || es;

  // i18n
  const months = t("app.datepicker.months", { returnObjects: true });
  const todayLabel = t("app.datepicker.today");
  const prevLabel = t("app.datepicker.prev");
  const nextLabel = t("app.datepicker.next");
  const dateFormat = t("app.datepicker.date_format");

  // Header compacto con botones redondeados y efecto glass
  function renderCustomHeader({
    date,
    decreaseMonth,
    increaseMonth,
    prevMonthButtonDisabled,
    nextMonthButtonDisabled,
  }) {
    const safeDate = date instanceof Date ? date : new Date(date);
    return (
      <div className="mb-2 flex items-center justify-between px-2 py-1">
        <button
          type="button"
          onClick={decreaseMonth}
          disabled={prevMonthButtonDisabled}
          className="rounded-full border border-white/10 px-3 py-1 text-sm
                     text-light-accent dark:text-dark-accent
                     hover:bg-white/10 dark:hover:bg-white/5
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          {prevLabel}
        </button>
        <span className="select-none font-semibold">
          {months?.[safeDate.getMonth()]} {safeDate.getFullYear()}
        </span>
        <button
          type="button"
          onClick={increaseMonth}
          disabled={nextMonthButtonDisabled}
          className="rounded-full border border-white/10 px-3 py-1 text-sm
                     text-light-accent dark:text-dark-accent
                     hover:bg-white/10 dark:hover:bg-white/5
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          {nextLabel}
        </button>
      </div>
    );
  }

  // Render de cada día (resalta hoy y el seleccionado con estilos glass)
  function renderDayContents(day, date) {
    const isSelected = value instanceof Date && isSameDay(date, value);
    const isToday = isSameDay(date, new Date());

    const base =
      "grid h-9 w-9 place-items-center rounded-xl text-sm transition-colors";
    const hover = "hover:bg-emerald-400/10 dark:hover:bg-emerald-300/10";
    const todayRing =
      isToday && !isSelected ? "ring-1 ring-emerald-400/40" : "";
    const selectedStyles = isSelected
      ? "bg-emerald-400/90 text-black shadow-[0_0_0_1px_rgba(16,185,129,0.5),0_8px_24px_rgba(16,185,129,0.35)]"
      : "";

    return (
      <span className={`${base} ${hover} ${todayRing} ${selectedStyles}`}>
        {day}
      </span>
    );
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <label className="mb-1 select-none text-xs font-semibold text-light-text-primary dark:text-dark-text-primary">
          {label}
        </label>
      )}

      <ReactDatePicker
        locale={locale}
        selected={value}
        onChange={onChange}
        minDate={minDate}
        maxDate={maxDate}
        placeholderText={placeholderText}
        disabled={disabled}
        dateFormat={dateFormat}
        popperPlacement="bottom-start"
        showPopperArrow={false}
        renderCustomHeader={renderCustomHeader}
        renderDayContents={renderDayContents}
        // POPPER
        popperClassName="z-[9999]"
        // CALENDARIO (glass card)
        calendarClassName={`
          !rounded-2xl
          !border !border-white/10
          !bg-white/10 dark:!bg-neutral-900/60
          !backdrop-blur-xl
          !text-light-text-primary dark:!text-dark-text-primary
          !shadow-[0_10px_30px_rgba(0,0,0,0.45)]
        
          /* HEADER: forzamos bg/border para respetar theme */
          [&_.react-datepicker__header]:!bg-transparent
          [&_.react-datepicker__header]:!border-b
          [&_.react-datepicker__header]:!border-white/10
          [&_.react-datepicker__header]:!pt-2
        
          /* Contenedor de nombres de días (línea bajo el header) */
          [&_.react-datepicker__day-names]:!bg-transparent
          [&_.react-datepicker__day-names]:!border-0
        
          /* FOOTER (botón Hoy) con look glass + hover */
          [&_.react-datepicker__today-button]:!bg-transparent
          [&_.react-datepicker__today-button]:!text-emerald-400
          [&_.react-datepicker__today-button]:hover:!bg-emerald-400/10
          [&_.react-datepicker__today-button]:dark:hover:!bg-emerald-300/10
          [&_.react-datepicker__today-button]:!font-semibold
          [&_.react-datepicker__today-button]:!rounded-b-2xl
          [&_.react-datepicker__today-button]:!border-t
          [&_.react-datepicker__today-button]:!border-white/10
        
          /* (Opcional) si activas time select, matchea también ese header */
          [&_.react-datepicker__header--time]:!bg-transparent
          [&_.react-datepicker__header--time]:!border-white/10
        `}
        
        // DÍAS (base; el contenido se estiliza en renderDayContents)
        dayClassName={() => `
          !p-0 !m-1
          !text-light-text-primary dark:!text-dark-text-primary
          focus:!outline-none
        `}
        // DÍAS DE SEMANA
        weekDayClassName={() => `
          !text-[10px] !uppercase !tracking-wider
          !font-semibold
          !text-emerald-500 dark:!text-emerald-300
        `}
        // INPUT (glass input)
        className={`
          w-full rounded-xl border
          bg-white/5 dark:bg-white/5
          backdrop-blur-md
          border-white/10 hover:border-white/20
          px-3 py-2
          text-light-text-primary dark:text-dark-text-primary
          placeholder:text-light-text-secondary dark:placeholder:text-dark-text-secondary
          focus:outline-none focus:ring-2 focus:ring-emerald-400/60
          transition-colors shadow-sm
          disabled:cursor-not-allowed disabled:opacity-60
        `}
        // BOTÓN "HOY"
        todayButton={todayLabel}
        {...props}
      />
    </div>
  );
};

export default DatePickerTheme;
