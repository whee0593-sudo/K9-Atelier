import { LuxuryButton } from "@/components/luxury/LuxuryButton";
import { PageShell } from "@/components/luxury/PageShell";

export const metadata = {
  title: "Gallery · K9 Atelier",
  description:
    "The K9 Atelier gallery is currently under construction.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function GalleryPage() {
  return (
    <PageShell
      eyebrow="Gallery"
      title="Under Construction"
      intro="Our full gallery is being prepared. A selection of recent work is available on the homepage."
    >
      <div className="flex justify-center">
        <LuxuryButton href="/#gallery" variant="secondary">
          Return to The Artistry
        </LuxuryButton>
      </div>
    </PageShell>
  );
}
