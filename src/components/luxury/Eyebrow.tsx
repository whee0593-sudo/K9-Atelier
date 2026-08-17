type Props = {
  children: React.ReactNode;
  className?: string;
};

export function Eyebrow({ children, className = "" }: Props) {
  return (
    <p
      className={`font-body text-[12px] font-medium uppercase tracking-[0.18em] text-taupe md:text-xs ${className}`}
    >
      {children}
    </p>
  );
}
