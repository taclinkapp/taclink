import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Sparkles, Trash2, ExternalLink, Eye, EyeOff, Wand2, Check, Heading2, Heading3, Bold, Italic, Link as LinkIcon, Image as ImageIcon, List, Quote, ImagePlus, FileText, Monitor, Link as LinkPlus } from "lucide-react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { ArrowUp, ArrowDown, Link2, Unlink, X as XIcon, GripVertical, AlignLeft, AlignCenter, AlignRight, Maximize2 } from "lucide-react";

type Topic = {
  id: string;
  title: string;
  target_keyword: string | null;
  location: string | null;
  notes: string | null;
  status: string;
  article_id: string | null;
  created_at: string;
};

type Article = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  meta_description: string | null;
  body_markdown: string;
  target_keyword: string | null;
  keywords: string[];
  cover_image_url: string | null;
  status: string;
  published_at: string | null;
  created_at: string;
};

const ACCEPTED_ARTICLE_MEDIA = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];

const articleMediaUrl = (path: string) =>
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-blog-media?path=${encodeURIComponent(path)}`;

const firstMarkdownImage = (markdown: string) => {
  const match = markdown.match(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/);
  return match?.[1] ?? null;
};

export default function AdminSEO() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [savingArticle, setSavingArticle] = useState(false);
  const [editorMode, setEditorMode] = useState<"edit" | "preview">("edit");
  const [previewArticle, setPreviewArticle] = useState<Article | null>(null);
  const [autoPublishEnabled, setAutoPublishEnabled] = useState<boolean | null>(null);
  const [autoPublishSaving, setAutoPublishSaving] = useState(false);


  // New topic form
  const [newTitle, setNewTitle] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [creatingTopic, setCreatingTopic] = useState(false);

  // AI suggestions
  type Suggestion = {
    title: string;
    primary_keyword: string;
    secondary_keywords: string[];
    questions: string[];
    angle: string;
  };
  const [suggestSeed, setSuggestSeed] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  // Body editor refs/helpers
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // AI internal-link suggestions
  type LinkSuggestion = { anchor: string; target_url: string; target_label: string; reason: string };
  const [linkSuggesting, setLinkSuggesting] = useState(false);
  const [linkSuggestions, setLinkSuggestions] = useState<LinkSuggestion[]>([]);
  const [linkSuggestOpen, setLinkSuggestOpen] = useState(false);

  const fetchInternalLinks = async () => {
    if (!editingArticle?.body_markdown?.trim()) { toast.error("Write some content first"); return; }
    setLinkSuggesting(true);
    setLinkSuggestOpen(true);
    setLinkSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke("seo-internal-links", {
        body: {
          article_id: editingArticle.id,
          body_markdown: editingArticle.body_markdown,
          title: editingArticle.title,
          target_keyword: editingArticle.target_keyword,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const s = ((data as any)?.suggestions ?? []) as LinkSuggestion[];
      if (!s.length) toast.error("No internal-link suggestions returned");
      setLinkSuggestions(s);
    } catch (e: any) {
      toast.error(e?.message ?? "Suggestion failed");
    } finally {
      setLinkSuggesting(false);
    }
  };

  const applyInternalLink = (s: LinkSuggestion) => {
    if (!editingArticle) return;
    const body = editingArticle.body_markdown;
    // Only replace the first occurrence that isn't already inside a markdown link
    const safe = s.anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<!\\]\\()${safe}(?!\\]\\()`);
    if (!re.test(body)) { toast.error("Anchor no longer in body"); return; }
    const next = body.replace(re, `[${s.anchor}](${s.target_url})`);
    setEditingArticle({ ...editingArticle, body_markdown: next });
    setLinkSuggestions((prev) => prev.filter((x) => x !== s));
    toast.success(`Linked "${s.anchor}"`);
  };

  const setBodyAtCursor = (next: string, cursor: number) => {
    if (!editingArticle) return;
    setEditingArticle({ ...editingArticle, body_markdown: next, cover_image_url: editingArticle.cover_image_url ?? firstMarkdownImage(next) });
    requestAnimationFrame(() => {
      const ta = bodyRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(cursor, cursor);
    });
  };

  const wrapOrInsertAtCursor = (before: string, after = "", placeholder = "") => {
    const ta = bodyRef.current;
    if (!ta || !editingArticle) return;
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    const value = ta.value;
    const selected = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    setBodyAtCursor(next, start + before.length + selected.length);
  };

  const insertHeading = (level: 2 | 3) => {
    const ta = bodyRef.current;
    if (!ta || !editingArticle) return;
    const hashes = "#".repeat(level);
    const start = ta.selectionStart ?? 0;
    const value = ta.value;
    // ensure heading sits on its own line
    const needsNewlineBefore = start > 0 && value[start - 1] !== "\n";
    wrapOrInsertAtCursor(`${needsNewlineBefore ? "\n" : ""}${hashes} `, "\n", "Heading");
  };

  const prefixSelectedLines = (prefix: string, placeholder: string) => {
    const ta = bodyRef.current;
    if (!ta || !editingArticle) return;
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    const value = ta.value;
    const selected = value.slice(start, end) || placeholder;
    const needsNewlineBefore = start > 0 && value[start - 1] !== "\n";
    const block = `${needsNewlineBefore ? "\n" : ""}${selected.split("\n").map((line) => `${prefix}${line}`).join("\n")}`;
    const next = value.slice(0, start) + block + value.slice(end);
    setBodyAtCursor(next, start + block.length);
  };

  const insertImagePrompt = () => {
    const url = window.prompt("Paste image or GIF URL (Giphy, Tenor, or a media URL):");
    if (!url) return;
    const alt = window.prompt("Alt text (describe the image — include your keyword if natural):", "") || "";
    const label = window.prompt("Optional caption label:", "Visual") || "Visual";
    wrapOrInsertAtCursor(`\n*${label}: ${alt || "Relevant article visual"}*\n\n![${alt}](${url.trim()})\n`, "");
  };

  const insertLinkPrompt = () => {
    const url = window.prompt("Link URL:");
    if (!url) return;
    wrapOrInsertAtCursor("[", `](${url.trim()})`, "link text");
  };

  const uploadMediaAndInsert = async (file: File) => {
    if (!editingArticle) return;
    if (!ACCEPTED_ARTICLE_MEDIA.includes(file.type)) { toast.error("Use PNG, JPG, GIF, or WebP"); return; }
    if (file.size > 20 * 1024 * 1024) { toast.error("Max 20MB"); return; }
    setUploadingMedia(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() || "bin";
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `articles/${editingArticle.id}/${crypto.randomUUID()}_${safeName}`.slice(0, 240) + (safeName.endsWith(ext) ? "" : `.${ext}`);
      const { error: upErr } = await supabase.storage.from("media-library").upload(path, file, {
        cacheControl: "31536000", upsert: false, contentType: file.type,
      });
      if (upErr) throw upErr;
      const alt = window.prompt("Alt text for this image:", file.name.replace(/\.[^.]+$/, "")) || "";
      const url = articleMediaUrl(path);
      const { data: row, error: insErr } = await supabase
        .from("media_assets")
        .insert({
          filename: file.name,
          storage_path: path,
          public_url: url,
          mime_type: file.type,
          file_size: file.size,
          alt_text: alt || null,
          uploaded_by: user.id,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      wrapOrInsertAtCursor(`\n*Visual: ${alt || "Article media"}*\n\n![${alt}](${url})\n`, "");
      if (row?.id) supabase.functions.invoke("media-analyze", { body: { id: row.id } });
      toast.success("Uploaded & inserted");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploadingMedia(false);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  };


  const fetchSuggestions = async () => {
    const seed = suggestSeed.trim() || newTitle.trim();
    if (!seed) { toast.error("Type a topic first"); return; }
    setSuggesting(true);
    setSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke("seo-suggest-topic", {
        body: {
          topic: seed,
          location: newLocation.trim() || undefined,
          notes: newNotes.trim() || undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const s = ((data as any)?.suggestions ?? []) as Suggestion[];
      if (!s.length) { toast.error("No suggestions returned"); return; }
      setSuggestions(s);
    } catch (e: any) {
      toast.error(e?.message ?? "Suggestion failed");
    } finally {
      setSuggesting(false);
    }
  };

  const applySuggestion = (s: Suggestion) => {
    setNewTitle(s.title);
    setNewKeyword(s.primary_keyword);
    const extra = [
      s.angle ? `Angle: ${s.angle}` : "",
      s.secondary_keywords?.length ? `Secondary keywords: ${s.secondary_keywords.join(", ")}` : "",
      s.questions?.length ? `Cover these questions:\n- ${s.questions.join("\n- ")}` : "",
    ].filter(Boolean).join("\n\n");
    setNewNotes((prev) => (prev?.trim() ? prev + "\n\n" + extra : extra));
    toast.success("Applied — review before queuing");
  };

  const loadAll = async () => {
    setLoading(true);
    const [t, a] = await Promise.all([
      supabase.from("seo_topics").select("*").order("created_at", { ascending: false }),
      supabase.from("seo_articles").select("*").order("created_at", { ascending: false }),
    ]);
    setTopics((t.data ?? []) as Topic[]);
    setArticles((a.data ?? []) as Article[]);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const addTopic = async () => {
    if (!newTitle.trim()) return;
    setCreatingTopic(true);
    const { error } = await supabase.from("seo_topics").insert({
      title: newTitle.trim(),
      target_keyword: newKeyword.trim() || null,
      location: newLocation.trim() || null,
      notes: newNotes.trim() || null,
    });
    setCreatingTopic(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Topic queued");
    setNewTitle(""); setNewKeyword(""); setNewLocation(""); setNewNotes("");
    loadAll();
  };

  const generate = async (topic: Topic) => {
    setGeneratingId(topic.id);
    try {
      const { data, error } = await supabase.functions.invoke("seo-generate-article", {
        body: { topic_id: topic.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Draft generated");
      loadAll();
    } catch (e: any) {
      toast.error(e?.message ?? "Generation failed");
    } finally {
      setGeneratingId(null);
    }
  };

  const generateAdHoc = async () => {
    if (!newTitle.trim()) { toast.error("Add a title first"); return; }
    setGeneratingId("adhoc");
    try {
      const { data, error } = await supabase.functions.invoke("seo-generate-article", {
        body: {
          title: newTitle.trim(),
          target_keyword: newKeyword.trim() || undefined,
          location: newLocation.trim() || undefined,
          notes: newNotes.trim() || undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Draft generated");
      setNewTitle(""); setNewKeyword(""); setNewLocation(""); setNewNotes("");
      loadAll();
    } catch (e: any) {
      toast.error(e?.message ?? "Generation failed");
    } finally {
      setGeneratingId(null);
    }
  };

  const deleteTopic = async (id: string) => {
    if (!confirm("Delete this topic?")) return;
    await supabase.from("seo_topics").delete().eq("id", id);
    loadAll();
  };

  const togglePublish = async (a: Article) => {
    const next = a.status === "published" ? "draft" : "published";
    const { error } = await supabase
      .from("seo_articles")
      .update({
        status: next,
        published_at: next === "published" ? (a.published_at ?? new Date().toISOString()) : null,
      })
      .eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success(next === "published" ? "Published" : "Unpublished");
    loadAll();
  };

  const deleteArticle = async (id: string) => {
    if (!confirm("Delete this article permanently?")) return;
    await supabase.from("seo_articles").delete().eq("id", id);
    loadAll();
  };

  const saveArticle = async () => {
    if (!editingArticle) return;
    setSavingArticle(true);
    const { error } = await supabase.from("seo_articles").update({
      title: editingArticle.title,
      slug: editingArticle.slug,
      excerpt: editingArticle.excerpt,
        meta_description: editingArticle.meta_description,
        body_markdown: editingArticle.body_markdown,
        cover_image_url: editingArticle.cover_image_url ?? firstMarkdownImage(editingArticle.body_markdown),
    }).eq("id", editingArticle.id);
    setSavingArticle(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setEditingArticle(null);
    loadAll();
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="h-6 w-6" /> SEO Content Engine
        </h1>
        <p className="text-sm text-muted-foreground">
          Queue topics → AI generates drafts → you review → publish to{" "}
          <Link to="/blog" className="text-primary hover:underline">/blog</Link>.
        </p>
      </div>

      <Tabs defaultValue="topics">
        <TabsList>
          <TabsTrigger value="topics">Topics ({topics.length})</TabsTrigger>
          <TabsTrigger value="articles">Articles ({articles.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="topics" className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-2 font-semibold">AI topic assistant</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Drop in a rough topic. AI returns angles + titles + primary keywords + question variants
              tuned to how ChatGPT, Perplexity & Google AI Overviews cite content.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={suggestSeed}
                onChange={(e) => setSuggestSeed(e.target.value)}
                placeholder="e.g. red dot pistol training for beginners"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); fetchSuggestions(); } }}
              />
              <Button onClick={fetchSuggestions} disabled={suggesting} className="shrink-0">
                {suggesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                Suggest angles
              </Button>
            </div>
            {suggestions.length > 0 && (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {suggestions.map((s, i) => (
                  <Card key={i} className="flex flex-col gap-2 p-3">
                    <p className="text-sm font-semibold leading-snug">{s.title}</p>
                    <p className="font-mono text-[11px] text-primary">{s.primary_keyword}</p>
                    {s.angle && <p className="text-xs text-muted-foreground italic">{s.angle}</p>}
                    {s.secondary_keywords?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {s.secondary_keywords.slice(0, 6).map((k) => (
                          <Badge key={k} variant="outline" className="text-[10px] font-normal">{k}</Badge>
                        ))}
                      </div>
                    )}
                    {s.questions?.length > 0 && (
                      <ul className="ml-4 list-disc space-y-0.5 text-[11px] text-muted-foreground">
                        {s.questions.slice(0, 4).map((q) => <li key={q}>{q}</li>)}
                      </ul>
                    )}
                    <Button size="sm" variant="secondary" className="mt-auto"
                      onClick={() => applySuggestion(s)}>
                      <Check className="mr-1 h-3 w-3" /> Use this
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 font-semibold">New topic</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Working title *</Label>
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="How to choose a CCW instructor in Texas" />
              </div>
              <div>
                <Label>Primary keyword</Label>
                <Input value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="ccw instructor texas" />
              </div>
              <div>
                <Label>Location (optional)</Label>
                <Input value={newLocation} onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="Austin, Texas" />
              </div>
              <div className="md:col-span-2">
                <Label>Notes for the AI (optional)</Label>
                <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Mention NRA certification, state-specific permit rules…" rows={3} />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={addTopic} disabled={creatingTopic || !newTitle.trim()}>
                {creatingTopic && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Queue topic
              </Button>
              <Button variant="secondary" onClick={generateAdHoc}
                disabled={generatingId !== null || !newTitle.trim()}>
                {generatingId === "adhoc" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Sparkles className="mr-2 h-4 w-4" />
                Generate now (skip queue)
              </Button>
            </div>
          </Card>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : topics.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No topics queued.</p>
          ) : (
            <div className="space-y-3">
              {topics.map((t) => (
                <Card key={t.id} className="flex items-start justify-between gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{t.title}</p>
                      <Badge variant={
                        t.status === "done" ? "default" :
                        t.status === "failed" ? "destructive" :
                        t.status === "generating" ? "secondary" : "outline"
                      }>{t.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.target_keyword && <>kw: <span className="font-mono">{t.target_keyword}</span> · </>}
                      {t.location && <>{t.location} · </>}
                      {new Date(t.created_at).toLocaleDateString()}
                    </p>
                    {t.notes && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.notes}</p>}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" onClick={() => generate(t)}
                      disabled={generatingId !== null || t.status === "generating"}>
                      {generatingId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteTopic(t.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="articles" className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : articles.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No articles yet. Queue a topic and click the spark to generate one.
            </p>
          ) : (
            <div className="space-y-3">
              {articles.map((a) => (
                <Card key={a.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{a.title}</p>
                        <Badge variant={a.status === "published" ? "default" : "outline"}>
                          {a.status}
                        </Badge>
                      </div>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">/blog/{a.slug}</p>
                      {a.excerpt && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{a.excerpt}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 md:flex-row">
                      <Button size="sm" variant="ghost" onClick={() => setPreviewArticle(a)} title="Preview as reader">
                        <Monitor className="mr-1 h-4 w-4" />Preview
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditingArticle(a); setEditorMode("edit"); }}>
                        Edit
                      </Button>
                      <Button size="sm" variant={a.status === "published" ? "secondary" : "default"}
                        onClick={() => togglePublish(a)}>
                        {a.status === "published" ? <><EyeOff className="mr-1 h-4 w-4"/>Unpublish</> : <><Eye className="mr-1 h-4 w-4"/>Publish</>}
                      </Button>
                      {a.status === "published" && (
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/blog/${a.slug}`} target="_blank">
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => deleteArticle(a.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {editingArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setEditingArticle(null)}>
          <Card className="max-h-[90vh] w-full max-w-3xl overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">{editorMode === "edit" ? "Edit article" : "Reader preview"}</h3>
              <div className="inline-flex rounded-md border border-input bg-muted/40 p-0.5">
                <Button type="button" size="sm" variant={editorMode === "edit" ? "secondary" : "ghost"} className="h-7 gap-1 px-2"
                  onClick={() => setEditorMode("edit")}>
                  <FileText className="h-3.5 w-3.5" />Edit
                </Button>
                <Button type="button" size="sm" variant={editorMode === "preview" ? "secondary" : "ghost"} className="h-7 gap-1 px-2"
                  onClick={() => setEditorMode("preview")}>
                  <Eye className="h-3.5 w-3.5" />Preview
                </Button>
              </div>
            </div>

            {editorMode === "preview" ? (
              <ArticleReaderPreview
                article={editingArticle}
                onChange={(body) => setEditingArticle({ ...editingArticle, body_markdown: body })}
              />
            ) : (
              <div className="space-y-3">
                <div>
                  <Label>Title</Label>
                  <Input value={editingArticle.title}
                    onChange={(e) => setEditingArticle({ ...editingArticle, title: e.target.value })} />
                </div>
                <div>
                  <Label>Slug</Label>
                  <Input value={editingArticle.slug}
                    onChange={(e) => setEditingArticle({ ...editingArticle, slug: e.target.value })} />
                </div>
                <div>
                  <Label>Excerpt</Label>
                  <Textarea value={editingArticle.excerpt ?? ""} rows={2}
                    onChange={(e) => setEditingArticle({ ...editingArticle, excerpt: e.target.value })} />
                </div>
                <div>
                  <Label>Meta description (SEO)</Label>
                  <Textarea value={editingArticle.meta_description ?? ""} rows={2}
                    onChange={(e) => setEditingArticle({ ...editingArticle, meta_description: e.target.value })} />
                </div>
                <div>
                  <Label>Body (markdown)</Label>
                  <div className="mt-1 flex flex-wrap items-center gap-1 rounded-t-md border border-b-0 border-input bg-muted/40 p-1">
                    <Button type="button" size="sm" variant="secondary" className="h-8 gap-1 px-2" title="Add section header" onClick={() => insertHeading(2)}><Heading2 className="h-4 w-4" />Header</Button>
                    <Button type="button" size="sm" variant="ghost" className="h-8 gap-1 px-2" title="Add subheader" onClick={() => insertHeading(3)}><Heading3 className="h-4 w-4" />Subhead</Button>
                    <span className="mx-1 h-5 w-px bg-border" />
                    <Button type="button" size="sm" variant="ghost" className="h-8 px-2" title="Bold" onClick={() => wrapOrInsertAtCursor("**", "**", "bold text")}><Bold className="h-4 w-4" /></Button>
                    <Button type="button" size="sm" variant="ghost" className="h-8 px-2" title="Italic" onClick={() => wrapOrInsertAtCursor("_", "_", "italic")}><Italic className="h-4 w-4" /></Button>
                    <Button type="button" size="sm" variant="ghost" className="h-8 px-2" title="Bulleted list" onClick={() => prefixSelectedLines("- ", "list item")}><List className="h-4 w-4" /></Button>
                    <Button type="button" size="sm" variant="ghost" className="h-8 px-2" title="Quote" onClick={() => prefixSelectedLines("> ", "quote")}><Quote className="h-4 w-4" /></Button>
                    <span className="mx-1 h-5 w-px bg-border" />
                    <Button type="button" size="sm" variant="ghost" className="h-8 px-2" title="Link" onClick={insertLinkPrompt}><LinkIcon className="h-4 w-4" /></Button>
                    <Button type="button" size="sm" variant="secondary" className="h-8 gap-1 px-2" title="Insert image or GIF by URL" onClick={insertImagePrompt}><ImageIcon className="h-4 w-4" />GIF URL</Button>
                    <Button type="button" size="sm" variant="default" className="h-8 gap-1 px-2" title="Upload image or GIF" disabled={uploadingMedia} onClick={() => uploadInputRef.current?.click()}>
                      {uploadingMedia ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                      Upload GIF
                    </Button>
                    <input ref={uploadInputRef} type="file" accept={ACCEPTED_ARTICLE_MEDIA.join(",")} hidden
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMediaAndInsert(f); }} />
                    <span className="mx-1 h-5 w-px bg-border" />
                    <Button type="button" size="sm" variant="secondary" className="h-8 gap-1 px-2"
                      title="AI suggests internal links to your courses & landing pages"
                      onClick={fetchInternalLinks} disabled={linkSuggesting}>
                      {linkSuggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      AI internal links
                    </Button>
                    <span className="ml-auto pr-1 text-[10px] text-muted-foreground">Headers use H2/H3 for SEO · GIFs insert at cursor</span>
                  </div>
                  <Textarea ref={bodyRef} value={editingArticle.body_markdown} rows={20}
                    className="rounded-t-none font-mono text-xs"
                    onChange={(e) => setEditingArticle({ ...editingArticle, body_markdown: e.target.value })} />
                </div>
              </div>
            )}
            {linkSuggestOpen && (
              <div className="mt-4 rounded-md border border-border bg-muted/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold flex items-center gap-1">
                    <LinkIcon className="h-4 w-4" /> AI internal-link suggestions
                  </p>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setLinkSuggestOpen(false)}>Close</Button>
                </div>
                {linkSuggesting && <p className="text-xs text-muted-foreground">Analyzing article & catalog…</p>}
                {!linkSuggesting && linkSuggestions.length === 0 && (
                  <p className="text-xs text-muted-foreground">No suggestions. Try adding more body content first.</p>
                )}
                <ul className="space-y-2">
                  {linkSuggestions.map((s, i) => (
                    <li key={i} className="flex items-start justify-between gap-3 rounded border border-border bg-card p-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm">
                          Link <span className="font-semibold">"{s.anchor}"</span> →{" "}
                          <span className="font-mono text-xs text-primary">{s.target_url}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{s.target_label}</div>
                        <div className="mt-1 text-[11px] italic text-muted-foreground">{s.reason}</div>
                      </div>
                      <Button type="button" size="sm" variant="secondary" onClick={() => applyInternalLink(s)}>
                        Insert
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditingArticle(null)}>Close</Button>
              <Button onClick={saveArticle} disabled={savingArticle}>
                {savingArticle && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </Card>
        </div>
      )}

      {previewArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewArticle(null)}>
          <Card className="max-h-[92vh] w-full max-w-3xl overflow-y-auto p-0"
            onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-card/95 px-4 py-2 backdrop-blur">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Reader preview · /blog/{previewArticle.slug}</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="default" disabled={savingArticle}
                  onClick={async () => {
                    setSavingArticle(true);
                    const { error } = await supabase.from("seo_articles").update({
                      body_markdown: previewArticle.body_markdown,
                      cover_image_url: previewArticle.cover_image_url,
                    }).eq("id", previewArticle.id);
                    setSavingArticle(false);
                    if (error) { toast.error(error.message); return; }
                    toast.success("Layout saved");
                    setArticles((prev) => prev.map((a) => a.id === previewArticle.id ? { ...a, body_markdown: previewArticle.body_markdown, cover_image_url: previewArticle.cover_image_url } : a));
                  }}>
                  {savingArticle && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Save layout
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPreviewArticle(null)}>Close</Button>
              </div>
            </div>
            <ArticleReaderPreview
              article={previewArticle}
              onChange={(body) => setPreviewArticle({ ...previewArticle, body_markdown: body })}
            />
          </Card>
        </div>
      )}
    </div>
  );
}

type Align = "none" | "left" | "right" | "center" | "full";
type MediaSegment = { kind: "media"; raw: string; images: string[]; align: Align; isRow: boolean };
type TextSegment = { kind: "text"; raw: string };
type Segment = MediaSegment | TextSegment;

const IMG_MD = /!\[[^\]]*\]\([^)\s]+(?:\s+"[^"]*")?\)/g;
const MEDIA_BLOCK =
  /(<div\s+class="(?:img-row|img-align-(?:left|right|center|full))"[^>]*>[\s\S]*?<\/div>|!\[[^\]]*\]\([^)\s]+(?:\s+"[^"]*")?\))/g;

function parseSegments(md: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of md.matchAll(MEDIA_BLOCK)) {
    const idx = m.index!;
    if (idx > last) out.push({ kind: "text", raw: md.slice(last, idx) });
    const raw = m[0];
    const images = raw.match(IMG_MD) ?? [raw];
    const alignMatch = raw.match(/class="img-align-(left|right|center|full)"/);
    const isRow = /class="img-row"/.test(raw);
    const align: Align = (alignMatch?.[1] as Align) ?? "none";
    out.push({ kind: "media", raw, images, align, isRow });
    last = idx + raw.length;
  }
  if (last < md.length) out.push({ kind: "text", raw: md.slice(last) });
  return out;
}

function joinSegments(segs: Segment[]): string {
  return segs.map((s) => s.raw).join("");
}

function buildBlock(images: string[], align: Align, isRow: boolean): string {
  const inner = images.join("\n\n");
  if (isRow) {
    const cls = align !== "none" && align !== "full" ? `img-row img-align-${align}` : "img-row";
    return `<div class="${cls}">\n\n${inner}\n\n</div>`;
  }
  if (align === "none") return images[0];
  return `<div class="img-align-${align}">\n\n${inner}\n\n</div>`;
}

function rebuild(seg: MediaSegment, patch: Partial<{ images: string[]; align: Align; isRow: boolean }>): MediaSegment {
  const images = patch.images ?? seg.images;
  const align = patch.align ?? seg.align;
  const isRow = patch.isRow ?? (images.length > 1);
  return { kind: "media", images, align, isRow, raw: buildBlock(images, align, isRow) };
}

function ArticleReaderPreview({ article, onChange }: { article: Article; onChange?: (body: string) => void }) {
  const bodyHasCover = !!article.cover_image_url && (article.body_markdown ?? "").includes(article.cover_image_url);
  const segments = parseSegments(article.body_markdown ?? "");
  const mediaIndices = segments
    .map((s, i) => (s.kind === "media" ? i : -1))
    .filter((i) => i >= 0);

  const [dragOrder, setDragOrder] = useState<number | null>(null);
  const [dropOrder, setDropOrder] = useState<number | null>(null);

  const updateAt = (segIndex: number, mutate: (seg: MediaSegment) => Segment | Segment[] | null) => {
    if (!onChange) return;
    const next: Segment[] = [];
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      if (i === segIndex && s.kind === "media") {
        const r = mutate(s);
        if (r === null) continue;
        if (Array.isArray(r)) next.push(...r);
        else next.push(r);
      } else {
        next.push(s);
      }
    }
    onChange(joinSegments(next));
  };

  const reorderMedia = (fromOrder: number, toOrder: number) => {
    if (!onChange || fromOrder === toOrder) return;
    const mediaSegs = mediaIndices.map((i) => segments[i] as MediaSegment);
    const [moved] = mediaSegs.splice(fromOrder, 1);
    mediaSegs.splice(toOrder, 0, moved);
    const next = [...segments];
    mediaIndices.forEach((segIdx, k) => { next[segIdx] = mediaSegs[k]; });
    onChange(joinSegments(next));
  };

  const pairWithNext = (segIndex: number) => {
    if (!onChange) return;
    const order = mediaIndices.indexOf(segIndex);
    const nextMediaIdx = mediaIndices[order + 1];
    if (nextMediaIdx === undefined) return;
    const a = segments[segIndex] as MediaSegment;
    const b = segments[nextMediaIdx] as MediaSegment;
    const merged = rebuild(a, { images: [...a.images, ...b.images], isRow: true, align: a.align });
    const next: Segment[] = [];
    for (let i = 0; i < segments.length; i++) {
      if (i === segIndex) next.push(merged);
      else if (i > segIndex && i <= nextMediaIdx) continue;
      else next.push(segments[i]);
    }
    onChange(joinSegments(next));
  };

  const unpair = (segIndex: number) => {
    updateAt(segIndex, (s) => {
      if (s.images.length < 2) return s;
      const expanded: Segment[] = [];
      s.images.forEach((img, i) => {
        expanded.push({ kind: "media", images: [img], raw: img, align: "none", isRow: false });
        if (i < s.images.length - 1) expanded.push({ kind: "text", raw: "\n\n" });
      });
      return expanded;
    });
  };

  const setAlign = (segIndex: number, align: Align) =>
    updateAt(segIndex, (s) => rebuild(s, { align }));

  const removeMedia = (segIndex: number) => updateAt(segIndex, () => null);

  const onDragStart = (order: number) => (e: React.DragEvent) => {
    setDragOrder(order);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(order));
  };
  const onDragOver = (order: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropOrder(order);
  };
  const onDrop = (order: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragOrder ?? Number(e.dataTransfer.getData("text/plain"));
    setDragOrder(null);
    setDropOrder(null);
    if (Number.isFinite(from)) reorderMedia(from, order);
  };

  return (
    <div className="bg-background text-foreground">
      {onChange && mediaIndices.length > 0 && (
        <div className="border-b border-border bg-muted/30 px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Arrange media · drag to reorder · choose left/right to wrap text · pair for side-by-side
          </p>
          <ul className="space-y-2">
            {mediaIndices.map((segIndex, order) => {
              const seg = segments[segIndex] as MediaSegment;
              const isRow = seg.isRow;
              const firstUrl = seg.images[0]?.match(/\(([^)\s]+)/)?.[1] ?? "";
              const isDropTarget = dropOrder === order && dragOrder !== null && dragOrder !== order;
              return (
                <li
                  key={segIndex}
                  draggable
                  onDragStart={onDragStart(order)}
                  onDragOver={onDragOver(order)}
                  onDragLeave={() => setDropOrder(null)}
                  onDrop={onDrop(order)}
                  onDragEnd={() => { setDragOrder(null); setDropOrder(null); }}
                  className={`flex items-center gap-2 rounded-md border p-2 transition ${
                    isDropTarget ? "border-primary bg-primary/10" : "border-border bg-card"
                  } ${dragOrder === order ? "opacity-50" : ""}`}
                >
                  <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
                  <span className="w-6 text-center text-xs text-muted-foreground">{order + 1}</span>
                  {firstUrl && (
                    <img src={firstUrl} alt="" className="h-10 w-14 rounded-sm border border-border object-cover" />
                  )}
                  <span className="flex-1 truncate text-xs">
                    {isRow ? `Row of ${seg.images.length} images` : firstUrl.split("/").pop()}
                    {seg.align !== "none" && (
                      <span className="ml-1 rounded bg-muted px-1 py-0.5 text-[10px] uppercase">{seg.align}</span>
                    )}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <Button type="button" size="sm" variant={seg.align === "left" ? "secondary" : "ghost"} className="h-7 w-7 p-0" title="Float left (text wraps right)"
                      onClick={() => setAlign(segIndex, seg.align === "left" ? "none" : "left")}>
                      <AlignLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="sm" variant={seg.align === "center" ? "secondary" : "ghost"} className="h-7 w-7 p-0" title="Center"
                      onClick={() => setAlign(segIndex, seg.align === "center" ? "none" : "center")}>
                      <AlignCenter className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="sm" variant={seg.align === "right" ? "secondary" : "ghost"} className="h-7 w-7 p-0" title="Float right (text wraps left)"
                      onClick={() => setAlign(segIndex, seg.align === "right" ? "none" : "right")}>
                      <AlignRight className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="sm" variant={seg.align === "full" ? "secondary" : "ghost"} className="h-7 w-7 p-0" title="Full width"
                      onClick={() => setAlign(segIndex, seg.align === "full" ? "none" : "full")}>
                      <Maximize2 className="h-3.5 w-3.5" />
                    </Button>
                    <span className="mx-1 h-5 w-px bg-border" />
                    <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" title="Move up"
                      disabled={order === 0} onClick={() => reorderMedia(order, order - 1)}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" title="Move down"
                      disabled={order === mediaIndices.length - 1} onClick={() => reorderMedia(order, order + 1)}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    {isRow ? (
                      <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 px-2" title="Split row back to stacked images"
                        onClick={() => unpair(segIndex)}>
                        <Unlink className="h-3.5 w-3.5" />Split
                      </Button>
                    ) : (
                      <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 px-2" title="Pair with the next image"
                        disabled={order === mediaIndices.length - 1} onClick={() => pairWithNext(segIndex)}>
                        <Link2 className="h-3.5 w-3.5" />Pair
                      </Button>
                    )}
                    <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" title="Remove"
                      onClick={() => removeMedia(segIndex)}>
                      <XIcon className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Drag a row by the grip handle to reorder. Left / Right floats the image so the article text wraps around it. Layout is saved with the article and shown on the published page.
          </p>
        </div>
      )}
      <div className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-sm text-muted-foreground">← The TacLink Journal</p>
        <header className="mt-6 mb-10 border-b border-border pb-8">
          <h1 className="font-display text-3xl leading-tight tracking-tight md:text-5xl">
            {article.title || "Untitled article"}
          </h1>
          <p className="mt-4 text-sm uppercase tracking-wider text-muted-foreground">
            {article.published_at
              ? new Date(article.published_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
              : "Draft — not yet published"}
          </p>
          {article.cover_image_url && !bodyHasCover && (
            <img src={article.cover_image_url} alt={article.title}
              className="mt-6 max-h-80 w-full rounded-md border border-border object-cover" />
          )}
        </header>
        <article className="prose prose-invert max-w-none prose-headings:font-display prose-headings:tracking-tight prose-a:text-primary prose-h2:mt-12 prose-h2:text-2xl prose-h3:mt-8 prose-h3:text-xl prose-p:leading-relaxed prose-img:mx-auto prose-img:max-h-80 prose-img:w-auto prose-img:rounded-md">
          <ReactMarkdown rehypePlugins={[rehypeRaw]}>{article.body_markdown || "_Nothing to preview yet._"}</ReactMarkdown>
        </article>
      </div>
    </div>
  );
}
