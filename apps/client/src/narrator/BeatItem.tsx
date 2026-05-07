import { useState } from "react";
import type { Beat } from "@tavern/shared";

import { useNarrator } from "./store.js";

type Props = { sceneId: string; beat: Beat };

type EditingState =
  | null
  | { kind: "narrator"; draft: string }
  | { kind: "player"; draft: string };

const displayedOutput = (beat: Beat): string =>
  beat.activeAlt >= 0 && beat.alts[beat.activeAlt]
    ? beat.alts[beat.activeAlt]!.narratorOutput
    : beat.narratorOutput;

export const BeatItem = ({ sceneId, beat }: Props) => {
  const {
    rerollBeat,
    regenerateBeat,
    editNarratorOutput,
    selectAlt,
    deleteBeat,
    live,
  } = useNarrator();
  const [editing, setEditing] = useState<EditingState>(null);

  const streaming = live.streaming;
  const totalAlts = beat.alts.length;
  const altIndex = beat.activeAlt;
  const altLabel =
    totalAlts === 0
      ? null
      : altIndex < 0
        ? `latest (${totalAlts + 1}/${totalAlts + 1})`
        : `alt ${altIndex + 1}/${totalAlts + 1}`;

  const closeEditor = () => setEditing(null);

  const onPlayerSave = async (draft: string) => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === beat.playerInput) return closeEditor();
    if (
      !confirm(
        "This regenerates from this beat. All later beats in this scene will be deleted. Continue?",
      )
    ) {
      return closeEditor();
    }
    closeEditor();
    await regenerateBeat(sceneId, beat.id, trimmed);
  };

  const onNarratorSave = async (draft: string) => {
    closeEditor();
    if (draft === beat.narratorOutput) return;
    await editNarratorOutput(sceneId, beat.id, draft);
  };

  const cyclePrev = () => {
    if (totalAlts === 0) return;
    const next = altIndex < 0 ? totalAlts - 1 : altIndex - 1;
    if (next < 0) return;
    void selectAlt(sceneId, beat.id, next);
  };
  const cycleNext = () => {
    if (totalAlts === 0) return;
    const next = altIndex < 0 ? -1 : altIndex + 1;
    if (next > totalAlts) return;
    void selectAlt(sceneId, beat.id, next === totalAlts ? -1 : next);
  };

  const isPlayerEdit = editing?.kind === "player";
  const isNarratorEdit = editing?.kind === "narrator";

  return (
    <article className="space-y-1">
      {isPlayerEdit ? (
        <div className="flex items-start gap-2 border-l-2 border-zinc-500 pl-3">
          <textarea
            autoFocus
            rows={2}
            className="flex-1 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none"
            value={editing.draft}
            onChange={(e) => setEditing({ kind: "player", draft: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onPlayerSave(editing.draft);
              } else if (e.key === "Escape") {
                closeEditor();
              }
            }}
          />
        </div>
      ) : (
        <div className="border-l-2 border-zinc-700 pl-3 text-zinc-300">{beat.playerInput}</div>
      )}
      {isNarratorEdit ? (
        <textarea
          autoFocus
          rows={6}
          className="w-full bg-zinc-900 px-2 py-1 text-sm text-zinc-100 outline-none"
          value={editing.draft}
          onChange={(e) => setEditing({ kind: "narrator", draft: e.target.value })}
          onBlur={() => void onNarratorSave(editing.draft)}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeEditor();
          }}
        />
      ) : (
        <div className="whitespace-pre-wrap text-zinc-100">{displayedOutput(beat)}</div>
      )}
      <div className="flex items-center gap-2 text-[10px] text-zinc-600">
        <span>{new Date(beat.createdAt).toLocaleTimeString()}</span>
        {beat.status !== "complete" && <span>· {beat.status}</span>}
        {altLabel && (
          <span className="ml-2 flex items-center gap-1">
            <button
              className="hover:text-zinc-200 disabled:opacity-30"
              onClick={cyclePrev}
              disabled={altIndex === 0}
              title="previous alt"
            >
              ‹
            </button>
            <span className="text-zinc-500">{altLabel}</span>
            <button
              className="hover:text-zinc-200 disabled:opacity-30"
              onClick={cycleNext}
              disabled={altIndex < 0}
              title="next alt"
            >
              ›
            </button>
          </span>
        )}
        <span className="flex-1" />
        <button
          className="hover:text-zinc-200 disabled:opacity-30"
          onClick={() => setEditing({ kind: "narrator", draft: beat.narratorOutput })}
          disabled={streaming || editing !== null}
        >
          edit
        </button>
        <button
          className="hover:text-zinc-200 disabled:opacity-30"
          onClick={() => setEditing({ kind: "player", draft: beat.playerInput })}
          disabled={streaming || editing !== null}
        >
          edit input
        </button>
        <button
          className="hover:text-zinc-200 disabled:opacity-30"
          onClick={() => void rerollBeat(sceneId, beat.id)}
          disabled={streaming || editing !== null}
        >
          reroll
        </button>
        <button
          className="hover:text-rose-400 disabled:opacity-30"
          onClick={() => {
            if (confirm("Delete this beat?")) void deleteBeat(sceneId, beat.id);
          }}
          disabled={streaming || editing !== null}
        >
          delete
        </button>
      </div>
    </article>
  );
};
