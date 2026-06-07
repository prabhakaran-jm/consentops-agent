/** Original mark for ConsentOps — shield + consent check + data nodes (not a third-party logo). */
export function ConsentOpsLogo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect width="40" height="40" rx="12" className="fill-cops-primary-container" />
      <path
        d="M20 8L28 11.5V19.5C28 25.2 24.6 30.4 20 32C15.4 30.4 12 25.2 12 19.5V11.5L20 8Z"
        className="stroke-cops-primary"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 19.5L18.8 21.8L23.8 16.8"
        className="stroke-cops-on-tertiary-container"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="14" r="1.25" className="fill-cops-secondary" />
      <circle cx="26" cy="14" r="1.25" className="fill-cops-secondary" />
      <circle cx="20" cy="27" r="1.25" className="fill-cops-secondary" />
    </svg>
  );
}
