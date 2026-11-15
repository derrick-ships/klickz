"use client";
import { useState } from "react";
import { styleCategories, styleLibrary } from "@/lib/style-library";

/** Pre-made styles, filterable by category. Picking one uses its examples as style references. */
export function StyleLibraryGrid({ onPick }: { onPick: (id: string) => void }) {
  const [category, setCategory] = useState<string>("all");
  const shown = styleLibrary.filter((s) => category === "all" || s.category === category);
  return (
    <div className="style-library">
      <div className="style-library-filter" role="group" aria-label="Category">
        {["all", ...styleCategories].map((c) => (
          <button key={c} type="button" className="tool-chip" aria-pressed={category === c} onClick={() => setCategory(c)}>
            {c === "all" ? "All" : c[0].toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>
      <div className="style-library-grid">
        {shown.map((style) => (
          <button key={style.id} type="button" className="style-library-card" onClick={() => onPick(style.id)} aria-label={`${style.name}, ${style.category}`}>
            <img src={style.images[0]} alt="" loading="lazy" width={480} height={270} />
            <span><strong>{style.name}</strong><small>{style.category}</small></span>
          </button>
        ))}
      </div>
    </div>
  );
}
