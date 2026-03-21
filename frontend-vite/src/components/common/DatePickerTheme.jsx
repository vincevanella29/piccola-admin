import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Calendar, ChevronsLeft, ChevronsRight } from "lucide-react";

/* ── helpers ───────────────────────────────────────────────────────────── */
const pad = (n) => String(n).padStart(2, "0");

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getCalendarGrid(year, month) {
  const first = new Date(year, month, 1);
  let startDay = first.getDay(); // 0=Sun..6=Sat
  // Make Monday the first day: Mon=0..Sun=6
  startDay = (startDay + 6) % 7;
  const days = daysInMonth(year, month);
  const grid = [];
  // Leading blanks
  for (let i = 0; i < startDay; i++) grid.push(null);
  for (let d = 1; d <= days; d++) grid.push(d);
  return grid;
}

function isSameDay(a, b) {
  if (!(a instanceof Date) || !(b instanceof Date)) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isDateDisabled(date, minDate, maxDate) {
  if (!date) return false;
  if (minDate && date < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) return true;
  if (maxDate && date > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate(), 23, 59, 59)) return true;
  return false;
}

const MONTH_NAMES_FALLBACK = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const WEEKDAY_NAMES = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

/* ── component ─────────────────────────────────────────────────────────── */
const DatePickerTheme = ({
  value,
  onChange,
  label,
  className = "",
  minDate,
  maxDate,
  placeholderText,
  disabled,
  showYearDropdown = false,
  ...props
}) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.split("-")[0] || "es";

  const monthNames = useMemo(() => {
    const translated = t("app.datepicker.months", { returnObjects: true });
    return Array.isArray(translated) ? translated : MONTH_NAMES_FALLBACK;
  }, [t]);

  const todayLabel = t("app.datepicker.today", "Hoy");

  // State
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState("days"); // 'days' | 'months' | 'years'
  const ref = useRef(null);

  // Current view (defaults to value month or today)
  const initDate = value instanceof Date ? value : new Date();
  const [viewYear, setViewYear] = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());

  // When value changes externally, sync the view
  useEffect(() => {
    if (value instanceof Date) {
      setViewYear(value.getFullYear());
      setViewMonth(value.getMonth());
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Grid for current view
  const grid = useMemo(() => getCalendarGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const today = useMemo(() => new Date(), []);

  // Navigation
  const prevMonth = useCallback(() => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }, [viewMonth]);

  const nextMonth = useCallback(() => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }, [viewMonth]);

  const prevYear = useCallback(() => setViewYear((y) => y - 1), []);
  const nextYear = useCallback(() => setViewYear((y) => y + 1), []);

  const goToday = useCallback(() => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
  }, []);

  const selectDay = useCallback((day) => {
    const selected = new Date(viewYear, viewMonth, day);
    if (isDateDisabled(selected, minDate, maxDate)) return;
    onChange?.(selected);
    setOpen(false);
  }, [viewYear, viewMonth, minDate, maxDate, onChange]);

  const selectMonth = useCallback((monthIdx) => {
    setViewMonth(monthIdx);
    setViewMode("days");
  }, []);

  const selectYear = useCallback((year) => {
    setViewYear(year);
    setViewMode("months");
  }, []);

  // Formatted input value
  const displayValue = useMemo(() => {
    if (!(value instanceof Date)) return "";
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }, [value]);

  // Year range for year picker
  const yearRange = useMemo(() => {
    const base = viewYear;
    const startY = base - 6;
    const arr = [];
    for (let y = startY; y <= startY + 11; y++) arr.push(y);
    return arr;
  }, [viewYear]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {label && (
        <label className="block text-[9px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1">
          {label}
        </label>
      )}

      {/* Input trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={`flex items-center gap-2 w-full h-8 pl-2.5 pr-2 rounded-lg text-xs font-medium text-left
          bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40
          text-light-text-primary dark:text-dark-text-primary
          border border-light-border/30 dark:border-dark-border/30
          hover:border-light-accent/50 dark:hover:border-dark-accent/50
          focus:outline-none focus:border-light-accent dark:focus:border-dark-accent
          disabled:opacity-40 disabled:cursor-not-allowed
          transition-colors`}
      >
        <Calendar size={13} className="text-light-text-secondary dark:text-dark-text-secondary shrink-0" />
        <span className={displayValue ? "" : "text-light-text-secondary dark:text-dark-text-secondary"}>
          {displayValue || placeholderText || "YYYY-MM-DD"}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-[9999] mt-1 w-[280px] rounded-xl
          bg-light-surface dark:bg-dark-surface
          border border-light-border/30 dark:border-dark-border/30
          shadow-[0_8px_30px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)]
          text-light-text-primary dark:text-dark-text-primary
          overflow-hidden select-none"
        >
          {/* Header Navigation */}
          <div className="flex items-center justify-between px-2 py-2 border-b border-light-border/20 dark:border-dark-border/20">
            <div className="flex items-center gap-0.5">
              <NavBtn onClick={prevYear} title="Año anterior"><ChevronsLeft size={14} /></NavBtn>
              {viewMode === "days" && <NavBtn onClick={prevMonth} title="Mes anterior"><ChevronLeft size={14} /></NavBtn>}
            </div>

            <div className="flex items-center gap-1">
              {viewMode === "days" && (
                <button
                  type="button"
                  onClick={() => setViewMode("months")}
                  className="px-2 py-1 rounded-lg text-xs font-bold hover:bg-light-surface-secondary/60 dark:hover:bg-dark-surface-secondary/60 transition-colors"
                >
                  {monthNames[viewMonth]}
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewMode(viewMode === "years" ? "days" : "years")}
                className="px-2 py-1 rounded-lg text-xs font-bold hover:bg-light-surface-secondary/60 dark:hover:bg-dark-surface-secondary/60 transition-colors"
              >
                {viewYear}
              </button>
            </div>

            <div className="flex items-center gap-0.5">
              {viewMode === "days" && <NavBtn onClick={nextMonth} title="Mes siguiente"><ChevronRight size={14} /></NavBtn>}
              <NavBtn onClick={nextYear} title="Año siguiente"><ChevronsRight size={14} /></NavBtn>
            </div>
          </div>

          {/* Body */}
          <div className="p-2">
            {/* ── Days view ── */}
            {viewMode === "days" && (
              <>
                {/* Weekday headers */}
                <div className="grid grid-cols-7 mb-1">
                  {WEEKDAY_NAMES.map((d) => (
                    <div key={d} className="text-center text-[9px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary py-0.5">
                      {d}
                    </div>
                  ))}
                </div>
                {/* Day cells */}
                <div className="grid grid-cols-7">
                  {grid.map((day, idx) => {
                    if (day === null) return <div key={`e-${idx}`} />;
                    const date = new Date(viewYear, viewMonth, day);
                    const isDisabled = isDateDisabled(date, minDate, maxDate);
                    const isSelected = value instanceof Date && isSameDay(date, value);
                    const isToday = isSameDay(date, today);

                    return (
                      <button
                        key={day}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => selectDay(day)}
                        className={`
                          h-8 w-full rounded-lg text-xs font-medium transition-colors
                          ${isSelected
                            ? "bg-light-accent dark:bg-dark-accent text-white font-bold"
                            : isToday
                              ? "ring-1 ring-inset ring-light-accent/40 dark:ring-dark-accent/40 text-light-accent dark:text-dark-accent font-bold"
                              : "hover:bg-light-surface-secondary/60 dark:hover:bg-dark-surface-secondary/60"
                          }
                          ${isDisabled ? "opacity-20 cursor-not-allowed" : "cursor-pointer"}
                        `}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── Months view ── */}
            {viewMode === "months" && (
              <div className="grid grid-cols-3 gap-1">
                {monthNames.map((name, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => selectMonth(idx)}
                    className={`py-2 rounded-lg text-xs font-semibold transition-colors
                      ${viewMonth === idx
                        ? "bg-light-accent dark:bg-dark-accent text-white"
                        : "hover:bg-light-surface-secondary/60 dark:hover:bg-dark-surface-secondary/60"
                      }
                    `}
                  >
                    {name?.slice(0, 3)}
                  </button>
                ))}
              </div>
            )}

            {/* ── Years view ── */}
            {viewMode === "years" && (
              <div className="grid grid-cols-3 gap-1">
                {yearRange.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => selectYear(y)}
                    className={`py-2 rounded-lg text-xs font-semibold transition-colors
                      ${viewYear === y
                        ? "bg-light-accent dark:bg-dark-accent text-white"
                        : "hover:bg-light-surface-secondary/60 dark:hover:bg-dark-surface-secondary/60"
                      }
                    `}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-2 py-1.5 border-t border-light-border/20 dark:border-dark-border/20">
            <button
              type="button"
              onClick={() => { goToday(); selectDay(today.getDate()); }}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-light-accent dark:text-dark-accent hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 transition-colors"
            >
              {todayLabel}
            </button>
            <button
              type="button"
              onClick={() => { onChange?.(null); setOpen(false); }}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-secondary/60 dark:hover:bg-dark-surface-secondary/60 transition-colors"
            >
              {t("app.datepicker.clear", "Limpiar")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Small nav button ──────────────────────────────────────────────────── */
const NavBtn = ({ children, onClick, title }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="p-1.5 rounded-lg text-light-text-secondary dark:text-dark-text-secondary
      hover:bg-light-surface-secondary/60 dark:hover:bg-dark-surface-secondary/60
      hover:text-light-text-primary dark:hover:text-dark-text-primary
      transition-colors"
  >
    {children}
  </button>
);

export default DatePickerTheme;
