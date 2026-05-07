import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";

import { Catalog } from "./surfaces/Catalog.js";
import { Play } from "./surfaces/Play.js";
import { Settings } from "./surfaces/Settings.js";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 text-sm tracking-wide ${isActive ? "text-zinc-50 border-b border-zinc-50" : "text-zinc-400 hover:text-zinc-200"}`;

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
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <div className="flex items-center gap-6">
          <span className="font-serif text-lg">Tavern</span>
          <nav className="flex gap-2">
            <NavLink to="/catalog" className={navClass}>Catalog</NavLink>
            <NavLink to="/play" className={navClass}>Play</NavLink>
            <NavLink to="/settings" className={navClass}>Settings</NavLink>
          </nav>
        </div>
        <span className="text-xs text-zinc-500">server: {health}</span>
      </header>
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Play />} />
          <Route path="/play" element={<Play />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
};
