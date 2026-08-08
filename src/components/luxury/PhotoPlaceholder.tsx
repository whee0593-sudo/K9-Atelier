type Props = {
  label: string;
  aspect?: "hero" | "landscape" | "portrait" | "square";
  className?: string;
};

const aspectClasses = {
  hero: "aspect-[4/5] md:aspect-[16/10]",
  landscape: "aspect-[4/3]",
  portrait: "aspect-[3/4]",
  square: "aspect-square",
};

export function PhotoPlaceholder({
  label,
  aspect = "landscape",
  className = "",
}: Props) {
  return (
    <div
      className={`relative overflow-hidden rounded-sm bg-dusty-lavender/50 ${aspectClasses[aspect]} ${className}`}
      role="img"
      aria-label={label}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-ivory/40 via-dusty-lavender/30 to-champagne/10" />
      <div className="absolute inset-0 flex items-end p-6 md:p-8">
        <p className="font-body max-w-xs text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
          {label}
        </p>
      </div>
    </div>
  );
}
