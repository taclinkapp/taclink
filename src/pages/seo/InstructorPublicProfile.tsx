import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Loader2 } from "lucide-react";
import { usePublishedCourses } from "@/hooks/useCourses";
import { CourseCard } from "@/components/CourseCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { fetchPublicProfileCard, type PublicProfileCard } from "@/lib/profilePhotos";

export default function InstructorPublicProfile() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<PublicProfileCard | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const { data: courses, isLoading } = usePublishedCourses();

  useEffect(() => {
    let alive = true;
    setLoadingProfile(true);
    fetchPublicProfileCard(id)
      .then((p) => alive && setProfile(p))
      .finally(() => alive && setLoadingProfile(false));
    return () => { alive = false; };
  }, [id]);

  const instructorCourses = useMemo(
    () => (courses ?? []).filter((c) => c.instructorId === id),
    [courses, id],
  );

  const name = profile?.display_name || "TacLink Instructor";
  const states = Array.from(new Set(instructorCourses.map((c) => c.state).filter(Boolean)));
  const categories = Array.from(new Set(instructorCourses.map((c) => c.category).filter(Boolean)));

  const title = `${name} — Verified Firearms & Tactical Instructor | TacLink`;
  const description = `${name} teaches ${categories.slice(0, 3).join(", ") || "tactical and firearms"} courses${states.length ? ` in ${states.slice(0, 3).join(", ")}` : ""}. Book directly on TacLink.`;
  const url = `https://taclink.app/instructors/${id}`;

  return (
    <main className="min-h-screen bg-background pb-12">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="profile" />
        {profile?.photo_url && <meta property="og:image" content={profile.photo_url} />}
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Person",
          name,
          url,
          image: profile?.photo_url || undefined,
          jobTitle: "Firearms & Tactical Instructor",
          worksFor: { "@type": "Organization", name: "TacLink", url: "https://taclink.app" },
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://taclink.app/" },
            { "@type": "ListItem", position: 2, name: "Instructors", item: "https://taclink.app/instructors" },
            { "@type": "ListItem", position: 3, name, item: url },
          ],
        })}</script>
      </Helmet>

      <header className="px-4 pt-8 pb-4 max-w-5xl mx-auto">
        <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Instructors" }, { label: name }]} />
        {loadingProfile ? (
          <div className="grid place-items-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <div className="mt-4 flex items-center gap-4">
            {profile?.photo_url && (
              <img src={profile.photo_url} alt={name} className="h-20 w-20 rounded-md object-cover border border-border" loading="lazy" />
            )}
            <div>
              <h1 className="font-stencil text-2xl md:text-3xl uppercase tracking-wider">{name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Verified TacLink instructor{categories.length ? ` · ${categories.join(", ")}` : ""}{states.length ? ` · ${states.join(", ")}` : ""}
              </p>
            </div>
          </div>
        )}
      </header>

      <section className="px-4 max-w-5xl mx-auto mt-4">
        <h2 className="font-stencil text-sm uppercase tracking-wider text-muted-foreground mb-3">Upcoming courses</h2>
        {isLoading ? (
          <div className="grid place-items-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : instructorCourses.length === 0 ? (
          <div className="rounded-md border border-border bg-card p-6 text-center text-muted-foreground">
            No upcoming courses listed. <Link to="/student" className="text-primary underline">Browse all courses</Link>.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {instructorCourses.map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        )}
      </section>
    </main>
  );
}
