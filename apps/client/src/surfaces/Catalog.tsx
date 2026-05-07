import { useEffect } from "react";
import { EntryEditor } from "../catalog/EntryEditor.js";
import { EntryList } from "../catalog/EntryList.js";
import { ReindexBar } from "../catalog/ReindexBar.js";
import { useCatalog } from "../catalog/store.js";
import { TypeTree } from "../catalog/TypeTree.js";

export const Catalog = () => {
  const load = useCatalog((s) => s.load);
  const error = useCatalog((s) => s.error);
  const loaded = useCatalog((s) => s.loaded);
  useEffect(() => {
    load();
  }, [load]);

  if (error) return <div className="p-4 text-sm text-rose-400">Error: {error}</div>;
  if (!loaded) return <div className="p-4 text-sm text-zinc-500">Loading catalog…</div>;

  return (
    <div className="flex h-full flex-col">
      <ReindexBar />
      <div className="flex flex-1 overflow-hidden">
        <TypeTree />
        <EntryList />
        <EntryEditor />
      </div>
    </div>
  );
};
