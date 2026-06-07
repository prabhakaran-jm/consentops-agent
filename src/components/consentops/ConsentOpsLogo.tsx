type LogoVariant = "embedded" | "badge";

type Props = {
  className?: string;
  variant?: LogoVariant;
};

/** Original mark — shield + consent check (no third-party logo). */
export function ConsentOpsLogo({ className, variant = "embedded" }: Props) {
  const sizeClass = className ?? (variant === "badge" ? "h-11 w-11 shrink-0" : "h-8 w-8 shrink-0");

  if (variant === "badge") {
    return (
      <svg
        className={sizeClass}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <rect width="40" height="40" rx="12" fill="#ffffff" stroke="#c6c6cd" strokeWidth="1" />
        <LogoMark />
      </svg>
    );
  }

  return (
    <svg
      className={sizeClass}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <LogoMark compact />
    </svg>
  );
}

function LogoMark({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <>
        <path
          d="M16 6L22 8.6V14.6C22 18.6 19.6 22.2 16 23.4C12.4 22.2 10 18.6 10 14.6V8.6L16 6Z"
          fill="#dce9ff"
          stroke="#006398"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M13.2 15.2L15.1 17.1L18.9 13.3"
          stroke="#009668"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    );
  }

  return (
    <>
      <path
        d="M20 9L27.5 12.2V19.2C27.5 24.2 24.4 28.8 20 30.2C15.6 28.8 12.5 24.2 12.5 19.2V12.2L20 9Z"
        fill="#e5eeff"
        stroke="#006398"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 19.5L18.8 21.8L23.8 16.8"
        stroke="#009668"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="14" r="1.5" fill="#006398" />
      <circle cx="26" cy="14" r="1.5" fill="#006398" />
      <circle cx="20" cy="27" r="1.5" fill="#006398" />
    </>
  );
}
