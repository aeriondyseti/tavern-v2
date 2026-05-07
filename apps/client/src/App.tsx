import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { QuickSwitcher } from "./stories/QuickSwitcher.js";
import { Catalog } from "./surfaces/Catalog.js";
import { Play } from "./surfaces/Play.js";
import { Settings } from "./surfaces/Settings.js";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `cursor-pointer px-2.5 py-1 text-xs uppercase tracking-wide transition-colors duration-200 focus:outline-none focus:ring-1 focus:ring-zinc-600 ${
    isActive ? "text-zinc-50 border-b border-zinc-50" : "text-zinc-500 hover:text-zinc-200"
  }`;

const isMac = (() => {
  if (typeof navigator === "undefined") return false;
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  const platform = uaData?.platform ?? navigator.platform ?? navigator.userAgent ?? "";
  return /mac|iphone|ipad/i.test(platform);
})();
const switcherHint = isMac ? "⌘K" : "Ctrl-K";

type HealthState = "loading" | "ok" | "degraded" | "offline";

export const App = () => {
  const [health, setHealth] = useState<HealthState>("loading");
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setHealth(d.ok ? "ok" : "degraded"))
      .catch(() => setHealth("offline"));
  }, []);

  const healthLabel: Record<HealthState, string> = {
    loading: "checking server",
    ok: "server ok",
    degraded: "server degraded",
    offline: "server offline",
  };
  const healthDot: Record<HealthState, string> = {
    loading: "bg-zinc-600 animate-pulse",
    ok: "bg-emerald-400",
    degraded: "bg-amber-400",
    offline: "bg-rose-400",
  };

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
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-zinc-800 px-1.5 py-0.5 font-mono text-zinc-400">
            <span aria-hidden="true">{switcherHint}</span>
            <span className="text-zinc-500">switch story</span>
          </span>
          <span
            className="inline-flex items-center gap-1.5"
            role="status"
            aria-label={healthLabel[health]}
            title={healthLabel[health]}
          >
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${healthDot[health]}`} />
          </span>
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
