import Image from "next/image";
import Link from "next/link";


// Existing portfolio assets; no new or generated imagery.
const work = {
  "full-groom": { src: "/images/gallery/teddy-bear-smile.jpg", alt: "Apricot poodle with a rounded teddy bear haircut by Penny", width: 1122, height: 1402 },
  "hand-stripping": { src: "/images/gallery/wall/gallery-16.png", alt: "Norwich Terrier with a hand-stripped coat, from Penny’s portfolio", width: 1364, height: 1153 },
  color: { src: "/images/gallery/creative-color.jpg", alt: "White dog with turquoise color on the ears, paws and tail, from Penny’s portfolio", width: 1122, height: 1402 },
} as const;

export function ServiceWorkPhoto({ slug }: { slug: string }) {
  const photo = work[slug as keyof typeof work];
  if (!photo) return null;
  return (
    <figure className="mx-auto max-w-sm">
      
        <Image {...photo} loading="eager" sizes="(max-width: 415px) calc(100vw - 2rem), 384px" className="h-auto max-h-[420px] w-full object-contain" />
      <figcaption className="font-body mt-3 text-center text-sm text-ink">
        <Link href="/gallery" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-deep-lavender">See Penny’s work</Link>
      </figcaption>
    </figure>
  );
}

