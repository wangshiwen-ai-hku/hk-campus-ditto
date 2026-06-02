import React from "react";

export function TagSelector({ title, values, setValues, items, renderLabel }: { title: React.ReactNode; values: string[]; setValues: (v: string[]) => void; items: string[]; renderLabel?: (item: string) => string; }) {
  function toggle(item: string) {
    setValues(values.includes(item) ? values.filter((v) => v !== item) : [...values, item]);
  }
  return (
    <div>
      <div className="mb-3 text-base font-black text-white">{title}</div>
      <div className="flex flex-wrap gap-3">
        {items.map((item) => {
          const active = values.includes(item);
          return (
            <button
              key={item}
              type="button"
              onClick={() => toggle(item)}
              className={`rounded-xl px-5 py-2.5 text-base font-black transition-all duration-300 ${
                active 
                  ? "bg-aura/90 text-white shadow-lg shadow-aura/20" 
                  : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              {renderLabel ? renderLabel(item) : item}
            </button>
          );
        })}
      </div>
    </div>
  );
}
