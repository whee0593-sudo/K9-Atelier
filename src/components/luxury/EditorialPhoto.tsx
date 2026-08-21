import Image from "next/image";

type Aspect = "hero" | "landscape" | "portrait" | "square";

type Props = {
  src: string;
  alt: string;
  aspect?: Aspect;
  className?: string;
  sizes?: string;
  priority?: boolean;
};

const aspectClasses: Record<Aspect, string> = {
  hero: "aspect-[4/5] md:aspect-[16/10]",
  landscape: "aspect-[4/3]",
  portrait: "aspect-[3/4]",
  square: "aspect-square",
};

export function EditorialPhoto({
  src,
  alt,
  aspect = "landscape",
  className = "",
  sizes = "(min-width: 768px) 50vw, 100vw",
  priority = false,
}: Props) {
  return (
    <div
      className={`relative overflow-hidden rounded-sm bg-dusty-lavender/50 ${aspectClasses[aspect]} ${className}`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className="object-cover"
      />
    </div>
  );
}
