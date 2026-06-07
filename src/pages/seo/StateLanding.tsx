import { useMemo } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Loader2 } from "lucide-react";
import { usePublishedCourses } from "@/hooks/useCourses";
import { CourseCard } from "@/components/CourseCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { stateBySlug, stateMatches, US_STATES } from "@/lib/seoLanding";

export default function StateLanding() {
  const { state: slug } = useParams<{ state: string }>();
  const state = slug ? stateBySlug(slug) : undefined;
  const { data: courses, isLoading } = usePublishedCourses();

  const filtered = useMemo(
    () => (state && courses ? courses.filter((c) => stateMatches(c.state, state)) : []),
    [courses, state],
  );

  if (!state) return <Navigate to="/student" replace />;

  const title = `Firearms & Tactical Instructors in ${state.name} | TacLink`;
  const description = `Find and book verified firearms, tactical, and self-defense instructors in ${state.name}. Browse upcoming courses near you on TacLink.`;
  const url = `https://taclink.app/train/${state.slug}`;

  const cities = Array.from(new Set(filtered.map((c) => c.city).filter(Boolean))).slice(0, 12);

  return (
    <main className="min-h-screen bg-background pb-12">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://taclink.app/" },
            { "@type": "ListItem", position: 2, name: "Train", item: "https://taclink.app/train" },
            { "@type": "ListItem", position: 3, name: state.name, item: url },
          ],
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: title,
          description,
          url,
          about: { "@type": "Place", name: state.name, address: { "@type": "PostalAddress", addressRegion: state.code, addressCountry: "US" } },
        })}</script>
      </Helmet>

      <header className="px-4 pt-8 pb-4 max-w-5xl mx-auto">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Train" }, { label: state.name }]} />
        <h1 className="font-stencil text-3xl md:text-4xl uppercase tracking-wider mt-3">
          Firearms & Tactical Training in {state.name}
        </h1>
        <p className="mt-3 text-muted-foreground max-w-2xl">
          Browse verified instructors and upcoming courses in {state.name}. Book directly on TacLink — pistol, rifle, CCW, combatives, medical, and more.
        </p>
        {cities.length > 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            Active cities: <span className="text-foreground">{cities.join(", ")}</span>
          </p>
        )}
      </header>

      <section className="px-4 max-w-5xl mx-auto">
        {isLoading ? (
          <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-md border border-border bg-card p-6 text-center text-muted-foreground">
            No upcoming courses in {state.name} yet. <Link to="/student" className="text-primary underline">Browse all courses</Link>.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        )}
      </section>

      <nav className="px-4 max-w-5xl mx-auto mt-12" aria-label="Other states">
        <h2 className="font-stencil text-sm uppercase tracking-wider text-muted-foreground mb-3">Train in another state</h2>
        <div className="flex flex-wrap gap-2">
          {US_STATES.filter((s) => s.code !== state.code).map((s) => (
            <Link key={s.code} to={`/train/${s.slug}`} className="text-xs px-3 py-1.5 rounded-md border border-border bg-card hover:border-primary/40 text-foreground">
              {s.name}
            </Link>
          ))}
        </div>
      </nav>
    </main>
  );
}
