"use client";
import { useState } from "react";

export function useLangState() {
  return useState("en");
}

export default function LangToggle({ lang, setLang }: { lang: string; setLang: (l: string) => void }) {
  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-full p-0.5">
      <button
        onClick={() => setLang("en")}
        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
          lang === "en" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
        }`}
      >
        English
      </button>
      <button
        onClick={() => setLang("es")}
        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
          lang === "es" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
        }`}
      >
        Español
      </button>
    </div>
  );
}
