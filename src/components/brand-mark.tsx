export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="32" cy="32" r="27" stroke="currentColor" strokeWidth="3.5" />
      <text
        x="32"
        y="34"
        dominantBaseline="middle"
        fill="currentColor"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="31"
        fontWeight="700"
        textAnchor="middle"
      >
        E
      </text>
    </svg>
  );
}
