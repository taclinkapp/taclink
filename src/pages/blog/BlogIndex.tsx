import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type Article = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  published_at: string | null;
};

export default function BlogIndex() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("seo_articles")
      .select("id, slug, title, excerpt, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setArticles((data ?? []) as Article[]);
        setLoading(false);
      });
  }, []);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://taclink.app/" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "https://taclink.app/blog" },
    ],
  };
  const blogJsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "The TacLink Journal",
    url: "https://taclink.app/blog",
    publisher: { "@type": "Organization", name: "TacLink" },
  };

  return (
    <>
      <Helmet>
        <title>TacLink Blog — Tactical training guides & instructor insights</title>
        <meta
          name="description"
          content="Practical guides on firearms training, self-defense, and finding the right tactical instructor. Written for serious students."
        />
        <link rel="canonical" href="https://taclink.app/blog" />
        <meta property="og:title" content="TacLink Blog" />
        <meta property="og:description" content="Practical guides on tactical training and instruction." />
        <meta property="og:url" content="https://taclink.app/blog" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify(blogJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
      </Helmet>

      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <header className="mb-12 border-b border-border pb-8">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← TacLink
            </Link>
            <h1 className="mt-4 font-display text-4xl tracking-tight md:text-5xl">
              The TacLink Journal
            </h1>
            <p className="mt-3 text-lg text-muted-foreground">
              Field-tested guides for students and instructors of the tactical arts.
            </p>
          </header>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : articles.length === 0 ? (
            <p className="py-16 text-center text-muted-foreground">
              No articles published yet. Check back soon.
            </p>
          ) : (
            <ul className="space-y-8">
              {articles.map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/blog/${a.slug}`}
                    className="group block rounded-lg p-4 -mx-4 transition hover:bg-muted/40"
                  >
                    <h2 className="text-2xl font-semibold leading-tight group-hover:text-primary">
                      {a.title}
                    </h2>
                    {a.excerpt && (
                      <p className="mt-2 text-muted-foreground">{a.excerpt}</p>
                    )}
                    {a.published_at && (
                      <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground/70">
                        {new Date(a.published_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
