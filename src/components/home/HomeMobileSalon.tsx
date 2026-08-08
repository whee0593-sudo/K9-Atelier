import { Container } from "@/components/luxury/Container";
import { LuxuryButton } from "@/components/luxury/LuxuryButton";
import { PhotoPlaceholder } from "@/components/luxury/PhotoPlaceholder";
import { SectionIntro } from "@/components/luxury/SectionIntro";

const features = [
  "Self-Contained",
  "Climate-Controlled",
  "Sanitized Between Appointments",
  "Cage-Free",
] as const;

export function HomeMobileSalon() {
  return (
    <section
      id="mobile-salon"
      className="scroll-mt-24 border-b border-gray-line/60 bg-dusty-lavender/20 py-16 md:py-24"
    >
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <PhotoPlaceholder
          aspect="landscape"
          label="Private mobile salon interior — photography forthcoming"
        />

        <div>
          <SectionIntro
            align="left"
            eyebrow="The Private Mobile Salon"
            title={
              <>
                Step Inside
                <br />
                Our Private Mobile Salon
              </>
            }
            body={
              <>
                <p>
                  Designed to feel less like a grooming van and more like a
                  private hotel spa.
                </p>
                <p className="mt-4">
                  K9 Atelier brings a calm, beautifully considered grooming
                  environment directly to your home — giving your dog individual
                  attention without the noise, cages or waiting rooms of a
                  traditional salon.
                </p>
              </>
            }
          />

          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {features.map((item) => (
              <li
                key={item}
                className="border-l border-champagne pl-4 font-body text-[11px] font-medium uppercase tracking-[0.14em] text-ink"
              >
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-10">
            <LuxuryButton href="/#mobile-salon" variant="secondary">
              Step Inside the Salon
            </LuxuryButton>
          </div>
        </div>
      </Container>
    </section>
  );
}
