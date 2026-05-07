import { useEffect } from "react";

import { useCatalog } from "../catalog/store.js";
import { TypeTree } from "../catalog/TypeTree.js";
import { EntryList } from "../catalog/EntryList.js";
import { EntryEditor } from "../catalog/EntryEditor.js";

export const Catalog = () => {
  const { load, error, loaded } = useCatalog();
  useEffect(() => {
    load();
  }, [load]);

  if (error) return <div className="p-4 text-sm text-rose-400">Error: {error}</div>;
  if (!loaded) return <div className="p-4 text-sm text-zinc-500">Loading catalog…</div>;

  return (
    <div className="flex h-full">
      <TypeTree />
      <EntryList />
      <EntryEditor />
    </div>
  );
};
