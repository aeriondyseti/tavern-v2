import type { SetupData } from "@tales/shared";
import { useEffect, useState } from "react";

import { useCatalog } from "../catalog/store.js";
import { BeatStream } from "../narrator/BeatStream.js";
import { DebugPanel } from "../narrator/DebugPanel.js";
import { useNarrator } from "../narrator/store.js";
import { AnchorEditor } from "../stories/AnchorEditor.js";
import { PinnedEditor } from "../stories/PinnedEditor.js";
import { ScenesPanel } from "../stories/ScenesPanel.js";
import { SetupEditor } from "../stories/SetupEditor.js";
import { StoriesPicker } from "../stories/StoriesPicker.js";
import { useStories } from "../stories/store.js";
import type { Scene, Story } from "../stories/types.js";

export const Play = () => {
  const catalogLoaded = useCatalog((s) => s.loaded);
  const loadCatalog = useCatalog((s) => s.load);
  const activeStory = useStories((s) => s.activeStory);
  const activeScene = useStories((s) => s.activeScene);
  const saveStorySetup = useStories((s) => s.saveStorySetup);
  const saveStoryPinned = useStories((s) => s.saveStoryPinned);
  const saveStoryAnchorFacets = useStories((s) => s.saveStoryAnchorFacets);
  const saveScenePinned = useStories((s) => s.saveScenePinned);
  const saveSceneAdjustments = useStories((s) => s.saveSceneAdjustments);
  const dropSceneAdjustments = useStories((s) => s.dropSceneAdjustments);
  const saveSceneAnchorFacets = useStories((s) => s.saveSceneAnchorFacets);
  const updateStory = useStories((s) => s.updateStory);
  const updateScene = useStories((s) => s.updateScene);

  useEffect(() => {
    if (!catalogLoaded) void loadCatalog();
  }, [catalogLoaded, loadCatalog]);

  return (
    <div className="flex h-full">
      <StoriesPicker />
      {!activeStory ? (
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
          Select a story, or create one.
        </div>
      ) : (
        <StoryDetail
          key={activeStory.id}
          story={activeStory}
          scene={activeScene}
          onStorySetupSave={(d) => saveStorySetup(activeStory.id, d)}
          onStoryPinnedSave={(ids) => saveStoryPinned(activeStory.id, ids)}
          onStoryProseSave={async (p) => {
            await updateStory(activeStory.id, { anchorProse: p });
          }}
          onStoryFacetsSave={(f) => saveStoryAnchorFacets(activeStory.id, f)}
          onSceneAdjustmentsSave={(d) => (activeScene ? saveSceneAdjustments(activeScene.id, d) : Promise.resolve())}
          onSceneAdjustmentsDrop={() => (activeScene ? dropSceneAdjustments(activeScene.id) : Promise.resolve())}
          onScenePinnedSave={(ids) => (activeScene ? saveScenePinned(activeScene.id, ids) : Promise.resolve())}
          onSceneProseSave={async (p) => {
            if (activeScene) await updateScene(activeScene.id, { anchorProse: p });
          }}
          onSceneFacetsSave={(f) => (activeScene ? saveSceneAnchorFacets(activeScene.id, f) : Promise.resolve())}
        />
      )}
    </div>
  );
};

const BeatStreamPane = ({ scene }: { scene: Scene }) => {
  const live = useNarrator((s) => s.live);
  const [showDebug, setShowDebug] = useState(false);
  const beats = useNarrator((s) => s.bySceneId[scene.id] ?? []);
  const lastBeatId = beats.length > 0 ? beats[beats.length - 1]!.id : null;
  const debugBeatId = live.beatId ?? lastBeatId;
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-hidden">
        <BeatStream sceneId={scene.id} sceneName={scene.name} />
      </div>
      <div className="flex items-center justify-end border-t border-zinc-800 px-3 py-1 text-xs">
        <button className="text-zinc-500 hover:text-zinc-200" onClick={() => setShowDebug((v) => !v)}>
          {showDebug ? "hide debug" : "show debug"}
        </button>
      </div>
      {showDebug && (
        <div className="h-64 shrink-0">
          <DebugPanel beatId={debugBeatId} />
        </div>
      )}
    </div>
  );
};

type DetailProps = {
  story: Story;
  scene: Scene | null;
  onStorySetupSave: (d: SetupData) => Promise<void>;
  onStoryPinnedSave: (ids: string[]) => Promise<void>;
  onStoryProseSave: (p: string) => Promise<void>;
  onStoryFacetsSave: (f: { label: string; body?: string }[]) => Promise<void>;
  onSceneAdjustmentsSave: (d: SetupData) => Promise<void>;
  onSceneAdjustmentsDrop: () => Promise<void>;
  onScenePinnedSave: (ids: string[]) => Promise<void>;
  onSceneProseSave: (p: string) => Promise<void>;
  onSceneFacetsSave: (f: { label: string; body?: string }[]) => Promise<void>;
};

const StoryDetail = ({
  story,
  scene,
  onStorySetupSave,
  onStoryPinnedSave,
  onStoryProseSave,
  onStoryFacetsSave,
  onSceneAdjustmentsSave,
  onSceneAdjustmentsDrop,
  onScenePinnedSave,
  onSceneProseSave,
  onSceneFacetsSave,
}: DetailProps) => {
  const [tab, setTab] = useState<"story" | "scene">("story");

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="border-b border-zinc-800 px-4 py-3">
        <h2 className="font-serif text-lg text-zinc-100">{story.name}</h2>
        {story.description && <p className="text-xs text-zinc-500">{story.description}</p>}
      </header>
      <div className="flex flex-1 overflow-hidden">
        <section className="flex flex-1 flex-col border-r border-zinc-800">
          {scene ? (
            <BeatStreamPane scene={scene} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-zinc-600">
              Set or create an active scene to begin.
            </div>
          )}
        </section>
        <aside className="w-[28rem] overflow-y-auto p-4">
          <nav className="mb-4 flex gap-2 border-b border-zinc-800">
            <button
              className={`px-3 py-1.5 text-xs ${tab === "story" ? "border-b border-zinc-50 text-zinc-50" : "text-zinc-500 hover:text-zinc-200"}`}
              onClick={() => setTab("story")}
            >
              Story
            </button>
            <button
              className={`px-3 py-1.5 text-xs ${tab === "scene" ? "border-b border-zinc-50 text-zinc-50" : "text-zinc-500 hover:text-zinc-200"} ${scene ? "" : "opacity-40"}`}
              onClick={() => scene && setTab("scene")}
              disabled={!scene}
            >
              Scene{scene ? ` — ${scene.name}` : ""}
            </button>
          </nav>
          {tab === "story" && (
            <div className="space-y-6">
              <SetupEditor scope="story" value={story.setup} onChange={onStorySetupSave} />
              <div>
                <h3 className="mb-2 font-serif text-sm uppercase tracking-wide text-zinc-300">Anchor</h3>
                <AnchorEditor
                  prose={story.anchorProse}
                  onProseChange={onStoryProseSave}
                  facets={story.anchorFacets}
                  onFacetsChange={onStoryFacetsSave}
                />
              </div>
              <div>
                <h3 className="mb-2 font-serif text-sm uppercase tracking-wide text-zinc-300">Pinned</h3>
                <PinnedEditor pinned={story.pinned} onChange={onStoryPinnedSave} />
              </div>
              <ScenesPanel />
            </div>
          )}
          {tab === "scene" && scene && (
            <div className="space-y-6">
              <header className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">
                  {scene.hasAdjustments ? "scene has adjustments" : "inheriting story setup"}
                </span>
                {scene.hasAdjustments ? (
                  <button className="text-xs text-zinc-400 hover:text-rose-300" onClick={onSceneAdjustmentsDrop}>
                    drop adjustments
                  </button>
                ) : (
                  <button
                    className="text-xs text-zinc-400 hover:text-zinc-100"
                    onClick={() => onSceneAdjustmentsSave(story.setup)}
                  >
                    fork from story setup
                  </button>
                )}
              </header>
              {scene.adjustments && (
                <SetupEditor scope="scene" value={scene.adjustments} onChange={onSceneAdjustmentsSave} />
              )}
              <div>
                <h3 className="mb-2 font-serif text-sm uppercase tracking-wide text-zinc-300">Scene anchor</h3>
                <AnchorEditor
                  prose={scene.anchorProse}
                  onProseChange={onSceneProseSave}
                  facets={scene.anchorFacets}
                  onFacetsChange={onSceneFacetsSave}
                />
              </div>
              <div>
                <h3 className="mb-2 font-serif text-sm uppercase tracking-wide text-zinc-300">Scene-only pinned</h3>
                <PinnedEditor pinned={scene.pinned} onChange={onScenePinnedSave} />
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
