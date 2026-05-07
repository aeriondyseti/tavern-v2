import type { SetupData } from "./setup.js";

export type AnchorFacet = { id: string; label: string; body: string; position: number };

export type PinnedEntry = {
  id: string;
  entryId: string;
  entryName: string;
  typeId: string;
  position: number;
};

export type SceneSummary = {
  id: string;
  name: string;
  anchorProse: string;
  position: number;
  hasAdjustments: boolean;
  createdAt: number;
};

export type Scene = SceneSummary & {
  storyId: string;
  adjustments: SetupData | null;
  pinned: PinnedEntry[];
  anchorFacets: AnchorFacet[];
};

export type StorySummary = {
  id: string;
  name: string;
  description: string;
  anchorProse: string;
  activeSceneId: string | null;
  sceneCount: number;
  createdAt: number;
  updatedAt: number;
};

export type Story = StorySummary & {
  setup: SetupData;
  scenes: SceneSummary[];
  pinned: PinnedEntry[];
  anchorFacets: AnchorFacet[];
};
