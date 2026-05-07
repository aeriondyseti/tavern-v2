import { useEffect, useState } from "react";
import type { SetupData } from "@tavern/shared";

import { useCatalog } from "../catalog/store.js";
import { AnchorEditor } from "../tales/AnchorEditor.js";
import { PinnedEditor } from "../tales/PinnedEditor.js";
import { ScenesPanel } from "../tales/ScenesPanel.js";
import { SetupEditor } from "../tales/SetupEditor.js";
import { TalesPicker } from "../tales/TalesPicker.js";
import { useTales } from "../tales/store.js";
import type { Scene, Tale } from "../tales/types.js";

export const Play = () => {
  const catalog = useCatalog();
  const {
    activeTale,
    activeScene,
    saveTaleSetup,
    saveTalePinned,
    saveTaleAnchorFacets,
    saveScenePinned,
    saveSceneAdjustments,
    dropSceneAdjustments,
    saveSceneAnchorFacets,
    updateTale,
    updateScene,
  } = useTales();

  useEffect(() => {
    if (!catalog.loaded) void catalog.load();
  }, [catalog]);

  return (
    <div className="flex h-full">
      <TalesPicker />
      {!activeTale ? (
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
          Select a tale, or create one.
        </div>
      ) : (
        <TaleDetail
          key={activeTale.id}
          tale={activeTale}
          scene={activeScene}
          onTaleSetupSave={(d) => saveTaleSetup(activeTale.id, d)}
          onTalePinnedSave={(ids) => saveTalePinned(activeTale.id, ids)}
          onTaleProseSave={(p) => updateTale(activeTale.id, { anchorProse: p }).then(() => undefined)}
          onTaleFacetsSave={(f) => saveTaleAnchorFacets(activeTale.id, f)}
          onSceneAdjustmentsSave={(d) => activeScene ? saveSceneAdjustments(activeScene.id, d) : Promise.resolve()}
          onSceneAdjustmentsDrop={() => activeScene ? dropSceneAdjustments(activeScene.id) : Promise.resolve()}
          onScenePinnedSave={(ids) => activeScene ? saveScenePinned(activeScene.id, ids) : Promise.resolve()}
          onSceneProseSave={async (p) => {
            if (activeScene) await updateScene(activeScene.id, { anchorProse: p });
          }}
          onSceneFacetsSave={(f) =>
            activeScene ? saveSceneAnchorFacets(activeScene.id, f) : Promise.resolve()
          }
        />
      )}
    </div>
  );
};

type DetailProps = {
  tale: Tale;
  scene: Scene | null;
  onTaleSetupSave: (d: SetupData) => Promise<void>;
  onTalePinnedSave: (ids: string[]) => Promise<void>;
  onTaleProseSave: (p: string) => Promise<void>;
  onTaleFacetsSave: (f: { label: string; body?: string }[]) => Promise<void>;
  onSceneAdjustmentsSave: (d: SetupData) => Promise<void>;
  onSceneAdjustmentsDrop: () => Promise<void>;
  onScenePinnedSave: (ids: string[]) => Promise<void>;
  onSceneProseSave: (p: string) => Promise<void>;
  onSceneFacetsSave: (f: { label: string; body?: string }[]) => Promise<void>;
};

const TaleDetail = ({
  tale,
  scene,
  onTaleSetupSave,
  onTalePinnedSave,
  onTaleProseSave,
  onTaleFacetsSave,
  onSceneAdjustmentsSave,
  onSceneAdjustmentsDrop,
  onScenePinnedSave,
  onSceneProseSave,
  onSceneFacetsSave,
}: DetailProps) => {
  const [tab, setTab] = useState<"tale" | "scene">("tale");

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="border-b border-zinc-800 px-4 py-3">
        <h2 className="font-serif text-lg text-zinc-100">{tale.name}</h2>
        {tale.description && <p className="text-xs text-zinc-500">{tale.description}</p>}
      </header>
      <div className="flex flex-1 overflow-hidden">
        <section className="flex flex-1 items-center justify-center border-r border-zinc-800 p-6 text-sm text-zinc-600">
          {scene ? `Open scene: ${scene.name}` : "Set or create an active scene to begin."}
        </section>
        <aside className="w-[28rem] overflow-y-auto p-4">
          <nav className="mb-4 flex gap-2 border-b border-zinc-800">
            <button
              className={`px-3 py-1.5 text-xs ${tab === "tale" ? "border-b border-zinc-50 text-zinc-50" : "text-zinc-500 hover:text-zinc-200"}`}
              onClick={() => setTab("tale")}
            >
              Tale
            </button>
            <button
              className={`px-3 py-1.5 text-xs ${tab === "scene" ? "border-b border-zinc-50 text-zinc-50" : "text-zinc-500 hover:text-zinc-200"} ${scene ? "" : "opacity-40"}`}
              onClick={() => scene && setTab("scene")}
              disabled={!scene}
            >
              Scene{scene ? ` — ${scene.name}` : ""}
            </button>
          </nav>
          {tab === "tale" && (
            <div className="space-y-6">
              <SetupEditor scope="tale" value={tale.setup} onChange={onTaleSetupSave} />
              <div>
                <h3 className="mb-2 font-serif text-sm uppercase tracking-wide text-zinc-300">
                  Anchor
                </h3>
                <AnchorEditor
                  prose={tale.anchorProse}
                  onProseChange={onTaleProseSave}
                  facets={tale.anchorFacets}
                  onFacetsChange={onTaleFacetsSave}
                />
              </div>
              <div>
                <h3 className="mb-2 font-serif text-sm uppercase tracking-wide text-zinc-300">
                  Pinned
                </h3>
                <PinnedEditor pinned={tale.pinned} onChange={onTalePinnedSave} />
              </div>
              <ScenesPanel />
            </div>
          )}
          {tab === "scene" && scene && (
            <div className="space-y-6">
              <header className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">
                  {scene.hasAdjustments ? "scene has adjustments" : "inheriting tale setup"}
                </span>
                {scene.hasAdjustments ? (
                  <button
                    className="text-xs text-zinc-400 hover:text-rose-300"
                    onClick={onSceneAdjustmentsDrop}
                  >
                    drop adjustments
                  </button>
                ) : (
                  <button
                    className="text-xs text-zinc-400 hover:text-zinc-100"
                    onClick={() => onSceneAdjustmentsSave(tale.setup)}
                  >
                    fork from tale setup
                  </button>
                )}
              </header>
              {scene.adjustments && (
                <SetupEditor scope="scene" value={scene.adjustments} onChange={onSceneAdjustmentsSave} />
              )}
              <div>
                <h3 className="mb-2 font-serif text-sm uppercase tracking-wide text-zinc-300">
                  Scene anchor
                </h3>
                <AnchorEditor
                  prose={scene.anchorProse}
                  onProseChange={onSceneProseSave}
                  facets={scene.anchorFacets}
                  onFacetsChange={onSceneFacetsSave}
                />
              </div>
              <div>
                <h3 className="mb-2 font-serif text-sm uppercase tracking-wide text-zinc-300">
                  Scene-only pinned
                </h3>
                <PinnedEditor pinned={scene.pinned} onChange={onScenePinnedSave} />
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
