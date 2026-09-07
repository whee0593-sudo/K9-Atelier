import { GalleryWall } from "@/components/gallery/GalleryWall";

export const metadata = {
  title: "Gallery · K9 Atelier",
  description: "A gallery of K9 Atelier grooming artistry and signature finishes.",
  robots: { index: false, follow: false },
};

export default function GalleryPage() {
  return (
    <main className="bg-[#0d110b] text-[#f3eee5]">
      <section className="mx-auto max-w-5xl px-6 pb-8 pt-16 text-center sm:pb-12 sm:pt-24">
        <p className="mb-4 text-[11px] uppercase tracking-[0.32em] text-[#b99d69]">K9 Atelier</p>
        <h1 className="font-serif text-4xl font-light tracking-[0.04em] sm:text-6xl">The Gallery</h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[#d8d0c4]/75 sm:text-base">
          A collection of signature finishes, show care, and creative grooming artistry.
        </p>
      </section>
      <GalleryWall />
      <p className="mx-auto max-w-3xl px-6 py-10 text-center text-[11px] uppercase tracking-[0.22em] text-[#c8bca9]/55 sm:py-14">
        Select a portrait to view the work in detail
      </p>
    </main>
  );
}
