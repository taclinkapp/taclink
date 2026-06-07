import { useMemo } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Loader2 } from "lucide-react";
import { usePublishedCourses } from "@/hooks/useCourses";
import { CourseCard } from "@/components/CourseCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { COURSE_CATALOG } from "@/lib/courseCatalog";
import { disciplineBySlug, disciplineSlug } from "@/lib/seoLanding";

export default function DisciplineLanding() {
  const { discipline: slug } = useParams<{ discipline: string }>();
  const cat = slug ? disciplineBySlug(slug) : undefined;
  const { data: courses, isLoading } = usePublishedCourses();

  const filtered = useMemo(
    () => (cat && courses ? courses.filter((c) => c.category === (cat.key as any)) : []),
    [courses, cat],
  );

  if (!cat) return <Navigate to="/student" replace />;

  const title = `${cat.label} Training & Courses | TacLink`;
  const description = `Book ${cat.label.toLowerCase()} training with verified instructors on TacLink. Compare upcoming courses, prices, locations, and skill levels.`;
  const url = `https://taclink.app/discipline/${disciplineSlug(cat.key)}`;

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
            { "@type": "ListItem", position: 2, name: "Disciplines", item: "https://taclink.app/discipline" },
            { "@type": "ListItem", position: 3, name: cat.label, item: url },
          ],
        })}</script>
      </Helmet>

      <header className="px-4 pt-8 pb-4 max-w-5xl mx-auto">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Disciplines" }, { label: cat.label }]} />
        <h1 className="font-stencil text-3xl md:text-4xl uppercase tracking-wider mt-3">{cat.label}</h1>
        <p className="mt-3 text-muted-foreground max-w-2xl">
          Find vetted {cat.label.toLowerCase()} instructors and book training directly. Course types include {cat.types.slice(0, 5).join(", ")}{cat.types.length > 5 ? ", and more." : "."}
        </p>
      </header>

      <section className="px-4 max-w-5xl mx-auto">
        {isLoading ? (
          <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-md border border-border bg-card p-6 text-center text-muted-foreground">
            No upcoming {cat.label.toLowerCase()} courses yet. <Link to="/student" className="text-primary underline">Browse all courses</Link>.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        )}
      </section>

      <nav className="px-4 max-w-5xl mx-auto mt-12" aria-label="Other disciplines">
        <h2 className="font-stencil text-sm uppercase tracking-wider text-muted-foreground mb-3">Other disciplines</h2>
        <div className="flex flex-wrap gap-2">
          {COURSE_CATALOG.filter((c) => c.key !== cat.key).map((c) => (
            <Link key={c.key} to={`/discipline/${disciplineSlug(c.key)}`} className="text-xs px-3 py-1.5 rounded-md border border-border bg-card hover:border-primary/40 text-foreground">
              {c.label}
            </Link>
          ))}
        </div>
      </nav>
    </main>
  );
}
