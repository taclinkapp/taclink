import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type Article = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  meta_description: string | null;
  body_markdown: string;
  cover_image_url: string | null;
  published_at: string | null;
  keywords: string[];
};

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    supabase
      .from("seo_articles")
      .select(
        "id, slug, title, excerpt, meta_description, body_markdown, cover_image_url, published_at, keywords",
      )
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle()
      .then(({ data }) => {
        if (!data) setNotFound(true);
        else setArticle(data as Article);
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <h1 className="text-2xl font-semibold">Article not found</h1>
          <Link to="/blog" className="mt-4 inline-block text-primary hover:underline">
            ← Back to the journal
          </Link>
        </div>
      </main>
    );
  }

  const url = `https://taclink.app/blog/${article.slug}`;
  const desc = article.meta_description || article.excerpt || "";

  return (
    <>
      <Helmet>
        <title>{article.title} — TacLink</title>
        {desc && <meta name="description" content={desc} />}
        <link rel="canonical" href={url} />
        <meta property="og:title" content={article.title} />
        {desc && <meta property="og:description" content={desc} />}
        <meta property="og:url" content={url} />
        <meta property="og:type" content="article" />
        {article.cover_image_url && (
          <meta property="og:image" content={article.cover_image_url} />
        )}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: article.title,
            description: desc,
            datePublished: article.published_at,
            mainEntityOfPage: url,
            author: { "@type": "Organization", name: "TacLink" },
            publisher: {
              "@type": "Organization",
              name: "TacLink",
              logo: { "@type": "ImageObject", url: "https://taclink.app/icons/icon-512.png" },
            },
            keywords: article.keywords?.join(", "),
          })}
        </script>
      </Helmet>

      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-2xl px-6 py-12 md:py-20">
          <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground">
            ← The TacLink Journal
          </Link>

          <header className="mt-6 mb-10 border-b border-border pb-8">
            <h1 className="font-display text-3xl leading-tight tracking-tight md:text-5xl">
              {article.title}
            </h1>
            {article.published_at && (
              <p className="mt-4 text-sm uppercase tracking-wider text-muted-foreground">
                {new Date(article.published_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            )}
          </header>

          <article className="prose prose-invert max-w-none prose-headings:font-display prose-headings:tracking-tight prose-a:text-primary prose-h2:mt-12 prose-h2:text-2xl prose-h3:mt-8 prose-h3:text-xl prose-p:leading-relaxed prose-img:mx-auto prose-img:max-h-96 prose-img:w-auto prose-img:rounded-md">
            <ReactMarkdown>{article.body_markdown}</ReactMarkdown>
          </article>

          <div className="mt-16 border-t border-border pt-8">
            <p className="text-muted-foreground">
              Ready to train?{" "}
              <Link to="/student" className="text-primary hover:underline">
                Browse verified instructors on TacLink →
              </Link>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
