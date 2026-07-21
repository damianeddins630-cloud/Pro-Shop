import Image from "next/image";
import Link from "next/link";

export default function BvbcPage() {
  return (
    <>
      <section className="relative min-h-[50vh] overflow-hidden">
        <Image src="/images/hero/slide-3.jpg" alt="" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-ink/80" />
        <div className="site-shell relative z-10 flex min-h-[50vh] flex-col justify-end pb-12 pt-28">
          <div className="mb-4 flex items-center gap-4">
            <Image
              src="/images/bvbc-mark.png"
              alt="Ballard vs The Big C"
              width={88}
              height={88}
              className="rounded-full border-2 border-red/70 bg-ink/50 p-2"
            />
            <div>
              <p className="text-sm tracking-[0.22em] text-red uppercase">Charity</p>
              <h1 className="display text-4xl md:text-6xl">Ballard vs. The Big &quot;C&quot;</h1>
            </div>
          </div>
          <p className="max-w-2xl text-mist">
            Striking Back to Spare More Lives — supporting cancer patients and caregivers through
            the sport of bowling.
          </p>
        </div>
      </section>

      <section className="site-shell section-pad grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5 leading-relaxed text-mist">
          <h2 className="display text-4xl text-chalk">Brief History</h2>
          <h3 className="text-xl font-semibold text-chalk">
            Del Ballard, Jr. and Carolyn Dorin-Ballard
          </h3>
          <p>
            Born into the environment of bowling, since the parents of both Del and Carolyn were
            avid bowlers, they were destined to use their talents in many ways.
          </p>
          <p>
            At 18 years of age, Del joined the PBA and earned 13 titles which included four major
            championships of which two were U.S. Open titles. He is ranked 29th among the greatest
            of all time and is currently one of the top national and international bowling coaches
            in the world. This 2009 USBC Hall of Famer is currently the Storm/Roto Grip PBA Tour
            rep as well as an international coach for Team Hong Kong.
          </p>
          <p>
            At 25, Carolyn joined the LPBT tour (later PWBA) and won 20 national championships,
            including three majors in her career. She also captured two USBC/PBA Women&apos;s World
            Series titles as well as the World Tour Championship in 2011. This 2008 USBC Hall of
            Famer admits she was never the most talented, but credits hard work and determination
            for her success.
          </p>
          <p>
            Off the lanes, Del and Carolyn are the owners of Ballard&apos;s Bowling Academy and
            Ballard&apos;s Bowling Academy Pro Shops — however, they both agree their greatest
            accomplishment is their daughter, Alyssa.
          </p>
          <p>
            The current passion for the Ballard family is their charity event: Ballard vs. The Big
            &quot;C&quot; Striking Back to Spare More Lives. The idea for the event took root after
            Del was diagnosed with tonsil cancer in 2010 which changed their lives forever. Over
            the years this event has contributed hundreds of thousands of dollars to support Baylor
            Scott &amp; White, North Texas Laryngectomy Society, and Cancer Care Services.
          </p>
          <p className="text-chalk italic">
            &quot;This is what we are supposed to do – help others who may not be able to help
            themselves as well as give back to our community through our sport.&quot;
          </p>
          <p>— Del and Carolyn Ballard</p>
        </div>

        <div className="space-y-5">
          <div className="overflow-hidden rounded-3xl border border-white/10">
            <Image
              src="/images/bvbc-flyer.png"
              alt="BVBC Flyer 2026"
              width={900}
              height={1200}
              className="h-auto w-full"
            />
          </div>
          <div className="rounded-3xl border border-red/25 bg-lane/40 p-6">
            <h3 className="display text-3xl">Where the $ Goes</h3>
            <p className="mt-3 text-sm leading-relaxed text-mist">
              With generous donations from our sponsors and supporters like you, we provide support
              to Baylor Scott &amp; White, Cancer Care Services of Fort Worth, and The North Texas
              Laryngectomy Society. Together we have provided over $700,000 in support and
              contributions for these organizations.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                className="btn btn-primary !text-sm"
                href="mailto:Contactus@ballardsbowlingacdemy.com?subject=BVBC%20Team%20Entry"
              >
                Team Entry Form
              </a>
              <a
                className="btn btn-ghost !text-sm"
                href="mailto:Contactus@ballardsbowlingacdemy.com?subject=BVBC%20Sponsorship"
              >
                Sponsorship Info
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="site-shell pb-16">
        <Link href="/sponsors" className="btn btn-ghost">
          Thank our sponsors →
        </Link>
      </section>
    </>
  );
}
