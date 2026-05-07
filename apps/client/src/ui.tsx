import type { ReactNode } from "react";

const PlusIcon = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

type NewButtonProps = {
  label: string;
  onClick: () => void;
  text?: ReactNode;
  disabled?: boolean;
  title?: string;
};

export const NewButton = ({ label, onClick, text, disabled, title }: NewButtonProps) => {
  const base =
    "inline-flex h-7 cursor-pointer items-center justify-center gap-1.5 border border-zinc-700 bg-zinc-800/50 text-zinc-300 transition-colors duration-200 hover:border-zinc-600 hover:bg-zinc-700 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-zinc-800/50 disabled:hover:text-zinc-300";
  const sizing = text ? "px-2.5 text-xs" : "w-7";
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizing}`}
    >
      <PlusIcon />
      {text && <span>{text}</span>}
    </button>
  );
};
