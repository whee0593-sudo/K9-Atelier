import Image from "next/image";
import Link from "next/link";
import { Cormorant_Garamond, Jost, Playfair_Display } from "next/font/google";
import { ComingSoonNotifyForm } from "@/components/coming-soon/ComingSoonNotifyForm";
import styles from "@/components/coming-soon/coming-soon.module.css";
import { business } from "@/lib/business";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["italic"],
  variable: "--font-cormorant",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-playfair",
});

const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-jost",
});

export const metadata = {
  title: "K9 Atelier — Opening Soon",
  description:
    "A private atelier experience is being prepared — cage-free, one-on-one mobile grooming for dogs under 45 lbs.",
};

export default function UnderConstructionPage() {
  const copy = business.site?.underConstruction;

  const wordmark = copy?.wordmark ?? "K9 ATELIER";
  const subline =
    copy?.subline ?? "Precision and devotion — in every appointment";
  const headline = copy?.headline ?? "Some things are worth the wait.";
  const lede = copy?.lede ?? [
    "A private atelier experience is being prepared — cage-free, one-on-one, and reserved exclusively for dogs under 45 lbs.",
    "By appointment only.",
  ];
  const locations =
    copy?.locations ??
    "West Palm Beach · Palm Beach Gardens · Jupiter";
  const signupLabel = copy?.signupLabel ?? "Be the first to know";
  const signupConfirm =
    copy?.signupConfirm ??
    "Thank you — you'll be the first to know when booking opens.";
  const instagramHandle = copy?.instagramHandle ?? "k9atelierfl";
  const instagramUrl =
    copy?.instagramUrl ?? "https://instagram.com/k9atelierfl";

  return (
    <div
      className={`${cormorant.variable} ${playfair.variable} ${jost.variable} relative flex min-h-screen items-center justify-center overflow-x-hidden px-6 py-8`}
      style={{ background: "#faf6ef", color: "#2e2a24" }}
    >
      <div className={styles.ambient} aria-hidden="true" />

      <main className={styles.page}>
        <Image
          src={business.brand.logo}
          alt={business.brand.name}
          width={140}
          height={140}
          className={styles.logo}
          priority
        />

        <h2 className={styles.wordmark}>{wordmark}</h2>
        <p className={styles.subline}>{subline}</p>

        <div className={styles.rule} />

        <h1 className={styles.headline}>{headline}</h1>

        {lede.map((paragraph) => (
          <p key={paragraph} className={styles.lede}>
            {paragraph}
          </p>
        ))}

        <p className={styles.location}>{locations}</p>

        <ComingSoonNotifyForm
          signupLabel={signupLabel}
          confirmMessage={signupConfirm}
        />

        <p className={styles.social}>
          Follow along{" "}
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            @{instagramHandle}
          </a>
        </p>

        <Link href="/login/admin" className={styles.teamLogin}>
          Team login
        </Link>
      </main>
    </div>
  );
}
