import { useState } from "react";
import type { Beat } from "@tavern/shared";

import { useNarrator } from "./store.js";

type Props = { sceneId: string; beat: Beat };

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
  const [editingNarrator, setEditingNarrator] = useState(false);
  const [narratorDraft, setNarratorDraft] = useState(beat.narratorOutput);
  const [editingPlayer, setEditingPlayer] = useState(false);
  const [playerDraft, setPlayerDraft] = useState(beat.playerInput);

  const streaming = live.streaming;
  const totalAlts = beat.alts.length;
  const altIndex = beat.activeAlt;
  const altLabel =
    totalAlts === 0
      ? null
      : altIndex < 0
        ? `latest (${totalAlts + 1}/${totalAlts + 1})`
        : `alt ${altIndex + 1}/${totalAlts + 1}`;

  const onPlayerSave = async () => {
    const trimmed = playerDraft.trim();
    if (!trimmed || trimmed === beat.playerInput) {
      setEditingPlayer(false);
      setPlayerDraft(beat.playerInput);
      return;
    }
    if (
      !confirm(
        "This regenerates from this beat. All later beats in this scene will be deleted. Continue?",
      )
    ) {
      setEditingPlayer(false);
      setPlayerDraft(beat.playerInput);
      return;
    }
    setEditingPlayer(false);
    await regenerateBeat(sceneId, beat.id, trimmed);
  };

  const onNarratorSave = async () => {
    setEditingNarrator(false);
    if (narratorDraft === beat.narratorOutput) return;
    await editNarratorOutput(sceneId, beat.id, narratorDraft);
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

  return (
    <article className="space-y-1">
      {editingPlayer ? (
        <div className="flex items-start gap-2 border-l-2 border-zinc-500 pl-3">
          <textarea
            autoFocus
            rows={2}
            className="flex-1 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none"
            value={playerDraft}
            onChange={(e) => setPlayerDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onPlayerSave();
              } else if (e.key === "Escape") {
                setEditingPlayer(false);
                setPlayerDraft(beat.playerInput);
              }
            }}
          />
        </div>
      ) : (
        <div className="border-l-2 border-zinc-700 pl-3 text-zinc-300">{beat.playerInput}</div>
      )}
      {editingNarrator ? (
        <textarea
          autoFocus
          rows={6}
          className="w-full bg-zinc-900 px-2 py-1 text-sm text-zinc-100 outline-none"
          value={narratorDraft}
          onChange={(e) => setNarratorDraft(e.target.value)}
          onBlur={() => void onNarratorSave()}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setEditingNarrator(false);
              setNarratorDraft(beat.narratorOutput);
            }
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
          onClick={() => {
            setNarratorDraft(beat.narratorOutput);
            setEditingNarrator(true);
          }}
          disabled={streaming}
        >
          edit
        </button>
        <button
          className="hover:text-zinc-200 disabled:opacity-30"
          onClick={() => {
            setPlayerDraft(beat.playerInput);
            setEditingPlayer(true);
          }}
          disabled={streaming}
        >
          edit input
        </button>
        <button
          className="hover:text-zinc-200 disabled:opacity-30"
          onClick={() => void rerollBeat(sceneId, beat.id)}
          disabled={streaming}
        >
          reroll
        </button>
        <button
          className="hover:text-rose-400"
          onClick={() => {
            if (confirm("Delete this beat?")) void deleteBeat(sceneId, beat.id);
          }}
          disabled={streaming}
        >
          delete
        </button>
      </div>
    </article>
  );
};
