import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is TacLink?",
    a: "TacLink is a marketplace that connects students with verified tactical, firearms, and self-defense instructors. Students can discover local courses, book classes in seconds, and train with confidence knowing every instructor on the platform is vetted.",
  },
  {
    q: "How do I find a firearms instructor near me?",
    a: "Open the Discover page, allow location access (or enter your city), and TacLink shows verified firearms and tactical instructors near you with course dates, pricing, disciplines, and student reviews. You can filter by discipline (pistol, rifle, CQB, combatives, protection, field, medical, tactics) and skill level.",
  },
  {
    q: "How does booking work?",
    a: "Pick a course, choose an available date, and check out securely with a card. Your seat is held instantly. You'll get a confirmation, a calendar invite, and direct messaging with your instructor. The instructor sees your booking on their roster and can scan you in on the day of the course.",
  },
  {
    q: "How are instructors verified?",
    a: "Every instructor on TacLink uploads their credentials (certifications, military / law-enforcement background, training lineage). Our admin team reviews each submission before the profile goes live. Verified instructors get a badge so students know who has passed review.",
  },
  {
    q: "What disciplines does TacLink cover?",
    a: "TacLink covers eight core tactical disciplines: pistol, rifle, close-quarters battle (CQB), combatives, protection / executive protection, field craft, tactical medical, and tactics. Each instructor lists the disciplines and skill levels they teach.",
  },
  {
    q: "Is TacLink available as an app?",
    a: "Yes. TacLink is a Progressive Web App — install it to your iPhone or Android home screen from your browser for a full app experience with push notifications, offline support, and one-tap launch. Native iOS and Android apps are on the roadmap.",
  },
  {
    q: "How do students get paid back if they cancel?",
    a: "Refunds follow the course's posted cancellation window. Inside the refund window, cancellations are processed automatically back to your original payment method. Outside the window, refunds are at the instructor's discretion or covered by TacLink's cancellation policy in qualifying cases. See the Cancellations FAQ for full details.",
  },
  {
    q: "How do instructors get paid?",
    a: "Student payments are held securely in escrow until the course completes. After class, funds release to the instructor's connected payout account (Helcim) automatically. Instructors can track upcoming and completed payouts inside their dashboard.",
  },
];

export default function Faq() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://taclink.app/" },
      { "@type": "ListItem", position: 2, name: "FAQ", item: "https://taclink.app/faq" },
    ],
  };

  return (
    <>
      <Helmet>
        <title>TacLink FAQ — Booking, instructors, refunds & how it works</title>
        <meta
          name="description"
          content="Answers to the most common questions about TacLink: how to find a verified firearms instructor, how booking and refunds work, supported disciplines, and how instructors get paid."
        />
        <link rel="canonical" href="https://taclink.app/faq" />
        <meta property="og:title" content="TacLink FAQ" />
        <meta
          property="og:description"
          content="Booking, instructor verification, refunds, payouts, disciplines, and more."
        />
        <meta property="og:url" content="https://taclink.app/faq" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
      </Helmet>

      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <header className="mb-10 border-b border-border pb-8">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← TacLink
            </Link>
            <h1 className="mt-4 font-display text-4xl tracking-tight md:text-5xl">
              Frequently Asked Questions
            </h1>
            <p className="mt-3 text-lg text-muted-foreground">
              Everything you need to know about booking, training, and getting paid on TacLink.
            </p>
          </header>

          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((item, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left text-lg font-semibold">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-12 rounded-lg border border-border bg-muted/30 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Still have a question?
            </p>
            <Link
              to="/support/contact"
              className="mt-2 inline-block font-semibold text-primary hover:underline"
            >
              Contact TacLink Support →
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
