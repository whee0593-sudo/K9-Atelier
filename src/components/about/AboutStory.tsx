import Image from "next/image";
import type { ReactNode } from "react";
import { Container } from "@/components/luxury/Container";

const awards = [
  { year: "2014", title: "Best in Group", breed: "Pomeranian" },
  { year: "2017", title: "Best in Group", breed: "Poodle" },
  { year: "2019", title: "Best in Show", breed: "Bichon" },
] as const;

const photos = {
  portrait: {
    src: "/images/about/about-professional-portrait.jpg",
    alt: "Penny in a black suit beside a white dog, a formal studio portrait",
    width: 418,
    height: 406,
  },
  group: {
    src: "/images/about/about-competition-group.jpg",
    alt: "Groomers and their dogs gathered on a professional grooming competition floor",
    width: 700,
    height: 433,
  },
  grooming: {
    src: "/images/about/about-competition-grooming.jpg",
    alt: "Penny grooming during a professional grooming competition",
    width: 2400,
    height: 1600,
  },
  trophy: {
    src: "/images/about/about-2019-trophy.jpg",
    alt: "Penny receiving an award at a professional grooming competition",
    width: 960,
    height: 640,
  },
  award: {
    src: "/images/about/about-2019-award.jpg",
    alt: "Penny with a white Bichon, a trophy, and award rosettes after Best in Show in 2019",
    width: 960,
    height: 801,
  },
  credentials: {
    src: "/images/about/about-awards-credentials.jpg",
    alt: "Professional grooming awards, rosettes and certificates",
    width: 960,
    height: 720,
  },
  teaching: {
    src: "/images/about/about-teaching.jpg",
    alt: "Penny demonstrating grooming technique during hands-on instruction",
    width: 1016,
    height: 1080,
  },
  craft: {
    src: "/images/about/about-craft-detail.jpg",
    alt: "Penny finishing a detailed facial trim",
    width: 1460,
    height: 1078,
  },
} as const;

const eyebrowClass =
  "font-body text-[12px] font-medium uppercase tracking-[0.22em] text-deep-lavender md:text-[13px]";

const headingClass =
  "font-display mt-5 text-balance text-[clamp(2.15rem,4.2vw+1rem,3.7rem)] leading-[1.08] font-medium tracking-[-0.02em] text-ink";

const proseClass =
  "font-body max-w-[40rem] space-y-6 text-[16px] leading-[1.8] text-taupe md:text-[18px] md:leading-[1.85]";

const captionClass =
  "font-body mt-3 text-[11px] font-medium uppercase tracking-[0.18em] text-taupe md:mt-4";

function AboutPhoto({
  src,
  alt,
  width,
  height,
  sizes,
  className = "h-auto w-full",
  priority = false,
  objectPosition = "center",
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes: string;
  className?: string;
  priority?: boolean;
  objectPosition?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      priority={priority}
      quality={90}
      className={className}
      style={{ objectPosition }}
    />
  );
}

function AboutEyebrow({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p id={id} className={eyebrowClass}>
      {children}
    </p>
  );
}

function AwardsTimeline() {
  return (
    <div className="mt-16 md:mt-24 lg:mt-28">
      <ol className="md:hidden">
        {awards.map((award, index) => (
          <li key={award.year} className="relative pb-14 pl-10 last:pb-0">
            {index < awards.length - 1 ? (
              <span
                aria-hidden
                className="absolute top-3 bottom-0 left-[3px] w-px bg-champagne/55"
              />
            ) : null}
            <span
              aria-hidden
              className="absolute top-3 left-0 h-[7px] w-[7px] rounded-full bg-champagne"
            />
            <p className="font-display text-[3.35rem] leading-none text-ink min-[390px]:text-[3.6rem]">
              {award.year}
            </p>
            <p className="font-body mt-4 text-[12px] font-medium uppercase tracking-[0.16em] text-ink">
              {award.title}
            </p>
            <p className="font-display mt-2 text-[1.65rem] text-taupe italic">
              {award.breed}
            </p>
          </li>
        ))}
      </ol>

      <ol className="relative hidden md:grid md:grid-cols-3">
        <div
          aria-hidden
          className="pointer-events-none absolute top-[calc(4.5rem+2rem+3.5px)] right-[16.67%] left-[16.67%] h-px bg-champagne/75 lg:top-[calc(5.4rem+2.5rem+3.5px)]"
        />
        {awards.map((award) => (
          <li key={award.year} className="relative text-center">
            <p className="font-display text-[4.5rem] leading-none text-ink lg:text-[5.4rem]">
              {award.year}
            </p>
            <div className="my-8 flex justify-center lg:my-10" aria-hidden>
              <span className="relative z-10 h-[7px] w-[7px] rounded-full bg-champagne ring-[6px] ring-ivory" />
            </div>
            <p className="font-body text-[11px] font-medium uppercase tracking-[0.16em] text-ink lg:text-[13px] lg:tracking-[0.18em]">
              {award.title}
            </p>
            <p className="font-display mt-3 text-[1.7rem] text-taupe italic lg:text-[2rem]">
              {award.breed}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function AboutStory() {
  return (
    <div className="overflow-x-clip">
      <Container>
        <article className="pb-20 md:pb-28 lg:pb-36">
          <section
            className="pt-16 md:pt-24 lg:pt-28"
            aria-labelledby="about-penny"
          >
            <div className="lg:grid lg:grid-cols-[minmax(15rem,22rem)_minmax(0,1fr)] lg:items-start lg:gap-x-16 xl:gap-x-24">
              <header className="max-w-[44rem] lg:col-start-2 lg:row-start-1">
                <AboutEyebrow>About Penny</AboutEyebrow>
                <h1 id="about-penny" className={headingClass}>
                  A thoughtful approach to the art of grooming.
                </h1>
                <p className="font-display mt-8 text-[1.35rem] leading-snug text-ink italic md:text-[1.7rem]">
                  Multiple Award-Winning Show Groomer
                </p>
                <p className="font-body mt-3 text-[11px] font-medium uppercase tracking-[0.2em] text-deep-lavender md:text-[12px]">
                  Professional Groomer Since 2010
                </p>
              </header>

              <figure className="mt-10 max-w-[17.5rem] lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:mt-1 lg:max-w-none lg:self-start">
                <AboutPhoto
                  {...photos.portrait}
                  sizes="(min-width: 1024px) 352px, 280px"
                  priority
                  objectPosition="center center"
                  className="h-auto w-full"
                />
                <figcaption className={captionClass}>
                  Professional Groomer Since 2010
                </figcaption>
              </figure>

              <div className={`${proseClass} mt-10 lg:col-start-2 lg:row-start-2 lg:mt-10`}>
                <p>
                  I am Penny, the founder and groomer behind K9 Atelier.
                </p>
                <p>
                  Since 2010 I have worked as a professional groomer — in the
                  salon, in competition, and in the classroom. That experience
                  is where this story begins.
                </p>
              </div>
            </div>
          </section>

          <section
            className="mt-24 md:mt-32 lg:mt-40"
            aria-labelledby="about-show-ring"
          >
            <header className="max-w-[42rem]">
              <AboutEyebrow>From the Show Ring</AboutEyebrow>
              <h2 id="about-show-ring" className={headingClass}>
                Where precision became instinct.
              </h2>
            </header>
            <div className={`${proseClass} mt-8 md:mt-10`}>
              <p>
                Years of professional grooming and competition shaped the way I
                see every dog — from coat preparation and structure to balance,
                proportion, and the smallest finishing details.
              </p>
              <p>
                Competition taught me that a beautiful groom is never simply
                about following a pattern. It is about understanding the
                individual dog and bringing out what suits them best.
              </p>
            </div>

            <figure className="relative mt-14 -mx-4 md:mt-20 md:-mx-12 xl:-mx-20">
              <AboutPhoto
                {...photos.grooming}
                sizes="100vw"
                objectPosition="62% center"
                className="aspect-[3/2] h-auto w-full object-cover"
              />
            </figure>

            <div
              className="mt-8 -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-champagne md:mx-0 md:mt-16 md:grid md:snap-none md:grid-cols-12 md:items-start md:gap-x-8 md:overflow-visible md:px-0 md:pb-0 lg:mt-20 lg:gap-x-12 [&::-webkit-scrollbar]:hidden"
              tabIndex={0}
              role="region"
              aria-label="Competition photographs"
            >
              <figure className="w-[84%] shrink-0 snap-start md:col-span-5 md:mt-16 md:w-auto lg:mt-24">
                <AboutPhoto
                  {...photos.trophy}
                  sizes="(min-width: 768px) 40vw, 84vw"
                  objectPosition="72% center"
                  className="aspect-[3/2] w-full object-cover"
                />
              </figure>
              <figure className="w-[84%] shrink-0 snap-start md:col-span-6 md:col-start-7 md:w-auto">
                <AboutPhoto
                  {...photos.award}
                  sizes="(min-width: 768px) 46vw, 84vw"
                  objectPosition="center 42%"
                  className="aspect-[6/5] w-full object-cover"
                />
                <figcaption className={captionClass}>
                  2019 · Best in Show · Bichon
                </figcaption>
              </figure>
            </div>

            <figure className="mt-12 max-w-[16.5rem] sm:max-w-xs md:mt-20 md:max-w-sm">
              <AboutPhoto
                {...photos.group}
                sizes="(min-width: 768px) 384px, 70vw"
                objectPosition="center center"
              />
              <figcaption className="font-display mt-3 text-[1.2rem] leading-snug text-taupe italic md:mt-4 md:text-[1.45rem]">
                A life shaped by the grooming table.
              </figcaption>
            </figure>
          </section>

          <section
            className="mt-24 md:mt-32 lg:mt-40"
            aria-labelledby="about-awards"
          >
            <div className="grid items-end gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,26rem)] lg:gap-20">
              <header className="max-w-[36rem]">
                <AboutEyebrow>Award-Winning Experience</AboutEyebrow>
                <h2 id="about-awards" className={headingClass}>
                  Years of craft. Moments of recognition.
                </h2>
              </header>
              <figure className="max-w-sm lg:max-w-none lg:justify-self-end">
                <AboutPhoto
                  {...photos.credentials}
                  sizes="(min-width: 1024px) 416px, 100vw"
                  objectPosition="center center"
                />
              </figure>
            </div>
            <AwardsTimeline />
          </section>

          <section
            className="mt-24 md:mt-32 lg:mt-40"
            aria-labelledby="about-teaching"
          >
            <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-20 xl:gap-24">
              <figure className="-mx-4 lg:mx-0">
                <AboutPhoto
                  {...photos.teaching}
                  sizes="(min-width: 1024px) 58vw, 100vw"
                  objectPosition="center 46%"
                  className="aspect-[4/5] w-full object-cover lg:aspect-auto lg:h-auto"
                />
              </figure>
              <header>
                <AboutEyebrow>Sharing the Craft</AboutEyebrow>
                <h2 id="about-teaching" className={headingClass}>
                  Experience worth sharing.
                </h2>
                <div className={`${proseClass} mt-8 md:mt-10`}>
                  <p>
                    Over the years, my work has extended beyond the grooming
                    table to teaching and hands-on instruction — sharing
                    techniques, helping other groomers refine their skills, and
                    passing along the knowledge I gained through years of
                    professional grooming and competition.
                  </p>
                </div>
              </header>
            </div>
          </section>

          <section
            className="mt-24 md:mt-32 lg:mt-40"
            aria-labelledby="about-craft"
          >
            <figure className="-mx-4 md:mx-auto md:max-w-[920px]">
              <AboutPhoto
                {...photos.craft}
                sizes="(min-width: 768px) 920px, 100vw"
                objectPosition="34% center"
                className="aspect-[4/5] w-full object-cover md:aspect-[4/3]"
              />
            </figure>
            <header className="mt-12 max-w-[38rem] md:mt-16 md:ml-auto md:mr-[6%] lg:mt-20">
              <AboutEyebrow>The Craft</AboutEyebrow>
              <h2 id="about-craft" className={headingClass}>
                The details make the difference.
              </h2>
              <div className={`${proseClass} mt-8 md:mt-10`}>
                <p>
                  Competition taught me to look beyond the haircut — to
                  understand balance, structure, coat, movement, and the subtle
                  details that bring a groom together.
                </p>
                <p>
                  That same attention to detail continues to shape every
                  appointment today.
                </p>
              </div>
            </header>
          </section>

          <section
            className="mt-24 md:mt-32 lg:mt-40"
            aria-labelledby="about-approach"
          >
            <header className="max-w-[40rem]">
              <AboutEyebrow>The K9 Atelier Approach</AboutEyebrow>
              <h2 id="about-approach" className={headingClass}>
                Experience, made personal.
              </h2>
            </header>
            <div className={`${proseClass} mt-8 md:mt-10`}>
              <p>Today, I bring that experience into every K9 Atelier appointment.</p>
              <p>
                Each groom is approached individually — considering the dog’s
                coat, structure, lifestyle, personality, and comfort to create a
                look that feels polished, natural, and uniquely theirs.
              </p>
              <p>
                For me, thoughtful grooming is not about making every dog look
                the same. It is about understanding the dog in front of me.
              </p>
            </div>
          </section>

          <div className="mt-24 flex flex-col items-center px-2 text-center md:mt-36 lg:mt-44">
            <span aria-hidden className="h-px w-12 bg-champagne/80" />
            <p className="font-display mt-10 text-[clamp(1.9rem,2vw+1.15rem,2.85rem)] leading-tight font-normal text-ink italic md:mt-14">
              Grooming, elevated.
            </p>
          </div>
        </article>
      </Container>
    </div>
  );
}
