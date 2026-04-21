"use client";

import { useState, useEffect } from "react";

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface DobSelectProps {
  id: string;
  value: string; // "YYYY-MM-DD" or ""
  onChange: (dateStr: string) => void;
  lang: string;
  selectStyle: React.CSSProperties;
  labelStyle: React.CSSProperties;
}

export default function DobSelect({ id, value, onChange, lang, selectStyle, labelStyle }: DobSelectProps) {
  const isEs = lang === "es";
  const months = isEs ? MONTHS_ES : MONTHS_EN;

  // Parse existing value
  const parts = value ? value.split("-") : [];
  const [year, setYear] = useState(parts[0] || "");
  const [month, setMonth] = useState(parts[1] || "");
  const [day, setDay] = useState(parts[2] || "");

  // Sync from parent when value changes externally
  useEffect(() => {
    const p = value ? value.split("-") : [];
    setYear(p[0] || "");
    setMonth(p[1] || "");
    setDay(p[2] || "");
  }, [value]);

  const currentYear = new Date().getFullYear();

  const emitChange = (y: string, m: string, d: string) => {
    if (y && m && d) {
      onChange(`${y}-${m}-${d}`);
    } else {
      onChange("");
    }
  };

  const handleMonth = (v: string) => { setMonth(v); emitChange(year, v, day); };
  const handleDay = (v: string) => { setDay(v); emitChange(year, month, v); };
  const handleYear = (v: string) => { setYear(v); emitChange(v, month, day); };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 0.6fr 0.8fr", gap: 6 }}>
      <div>
        <label htmlFor={`${id}-month`} style={labelStyle}>{isEs ? "Mes" : "Month"}</label>
        <select
          id={`${id}-month`}
          style={selectStyle}
          value={month}
          onChange={(e) => handleMonth(e.target.value)}
          aria-required="true"
        >
          <option value="">{isEs ? "Mes" : "Month"}</option>
          {months.map((name, i) => (
            <option key={i} value={String(i + 1).padStart(2, "0")}>{name}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-day`} style={labelStyle}>{isEs ? "Día" : "Day"}</label>
        <select
          id={`${id}-day`}
          style={selectStyle}
          value={day}
          onChange={(e) => handleDay(e.target.value)}
          aria-required="true"
        >
          <option value="">{isEs ? "Día" : "Day"}</option>
          {Array.from({ length: 31 }, (_, i) => {
            const d = String(i + 1).padStart(2, "0");
            return <option key={d} value={d}>{d}</option>;
          })}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-year`} style={labelStyle}>{isEs ? "Año" : "Year"}</label>
        <select
          id={`${id}-year`}
          style={selectStyle}
          value={year}
          onChange={(e) => handleYear(e.target.value)}
          aria-required="true"
        >
          <option value="">{isEs ? "Año" : "Year"}</option>
          {Array.from({ length: 101 }, (_, i) => {
            const y = String(currentYear - i);
            return <option key={y} value={y}>{y}</option>;
          })}
        </select>
      </div>
    </div>
  );
}
