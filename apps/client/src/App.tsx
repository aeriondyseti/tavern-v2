import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";

import { Catalog } from "./surfaces/Catalog.js";
import { Play } from "./surfaces/Play.js";
import { Settings } from "./surfaces/Settings.js";
import { QuickSwitcher } from "./tales/QuickSwitcher.js";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `px-2.5 py-1 text-xs uppercase tracking-wide ${
    isActive
      ? "text-zinc-50 border-b border-zinc-50"
      : "text-zinc-500 hover:text-zinc-200"
  }`;

const isMac = (() => {
  if (typeof navigator === "undefined") return false;
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData;
  const platform = uaData?.platform ?? navigator.platform ?? navigator.userAgent ?? "";
  return /mac|iphone|ipad/i.test(platform);
})();
const switcherHint = isMac ? "⌘K" : "Ctrl-K";

export const App = () => {
  const [health, setHealth] = useState<string>("…");
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setHealth(d.ok ? "ok" : "?"))
      .catch(() => setHealth("offline"));
  }, []);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5">
        <div className="flex items-center gap-5">
          <span className="font-serif text-base">Tavern</span>
          <nav className="flex gap-1">
            <NavLink to="/play" className={navClass}>
              Play
            </NavLink>
            <NavLink to="/catalog" className={navClass}>
              Catalog
            </NavLink>
            <NavLink to="/settings" className={navClass}>
              Settings
            </NavLink>
          </nav>
        </div>
        <span className="flex items-center gap-3 text-[10px] text-zinc-500">
          <span>{switcherHint} switch tale</span>
          <span>· {health}</span>
        </span>
      </header>
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Play />} />
          <Route path="/play" element={<Play />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
      <QuickSwitcher />
    </div>
  );
};
