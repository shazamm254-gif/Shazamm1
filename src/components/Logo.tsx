export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold ${className}`}>
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <rect width="24" height="24" rx="6" fill="#4f46e5" />
        <path d="M7 13l4-7 1 4h4l-4 7-1-4H7z" fill="#f59e0b" />
      </svg>
      <span>
        Proposal<span className="text-brand">Forge</span>
      </span>
    </span>
  );
}
