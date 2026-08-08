import { Eyebrow } from "./Eyebrow";

type Props = {
  eyebrow: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
};

export function SectionIntro({
  eyebrow,
  title,
  body,
  align = "center",
  className = "",
}: Props) {
  const alignClass = align === "center" ? "text-center mx-auto" : "text-left";

  return (
    <div className={`max-w-3xl ${alignClass} ${className}`}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="font-display mt-5 text-[2.625rem] leading-[1.08] font-medium text-ink md:text-5xl lg:text-[3.5rem]">
        {title}
      </h2>
      {body && (
        <div className="font-body mt-5 text-base leading-relaxed text-taupe md:text-[17px]">
          {body}
        </div>
      )}
    </div>
  );
}
