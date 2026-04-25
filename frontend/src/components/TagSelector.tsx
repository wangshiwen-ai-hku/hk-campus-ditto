import React from "react";

export function TagSelector({ title, values, setValues, items }: { title: string; values: string[]; setValues: (v: string[]) => void; items: string[]; }) {
  function toggle(item: string) {
    setValues(values.includes(item) ? values.filter((v) => v !== item) : [...values, item]);
  }
  return (
    <div>
      <div className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-white/30">{title}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const active = values.includes(item);
          return (
            <button
              key={item}
              type="button"
              onClick={() => toggle(item)}
              className={`rounded-full px-5 py-2.5 text-sm font-bold transition-all duration-300 ${
                active 
                  ? "bg-pink-500 text-white shadow-lg shadow-pink-500/20 scale-105" 
                  : "border border-white/5 bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
              }`}
            >
              {item}
            </button>
          );
        })}
      </div>
    </div>
  );
}
