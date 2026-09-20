import Image from "next/image";

type Props = {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  sizes?: string;
  priority?: boolean;
};

export function EditorialPhoto({
  src,
  alt,
  className = "",
  imageClassName = "max-h-[80vh]",
  sizes = "(min-width: 768px) 50vw, 100vw",
  priority = false,
}: Props) {
  return (
    <div
      className={`flex w-full min-w-0 items-center justify-center overflow-hidden rounded-sm bg-dusty-lavender/30 ${className}`}
    >
      <Image
        src={src}
        alt={alt}
        width={1600}
        height={2000}
        priority={priority}
        sizes={sizes}
        className={`h-auto w-auto max-w-full object-contain object-top ${imageClassName}`}
      />
    </div>
  );
}
