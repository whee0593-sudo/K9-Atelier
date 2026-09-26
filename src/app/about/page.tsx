import type { Metadata } from "next";
import { AboutStory } from "@/components/about/AboutStory";

export const metadata: Metadata = {
  title: "About · K9 Atelier",
  description:
    "Penny, founder and groomer of K9 Atelier — a multiple award-winning show groomer in practice since 2010. Competition, teaching, and the craft behind each private appointment.",
};

export default function AboutPage() {
  return <AboutStory />;
}
