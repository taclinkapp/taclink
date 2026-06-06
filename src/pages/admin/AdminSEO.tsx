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
import { Loader2, Sparkles, Trash2, ExternalLink, Eye, EyeOff, Wand2, Check, Heading1, Heading2, Heading3, Bold, Italic, Link as LinkIcon, Image as ImageIcon, List, Quote, ImagePlus } from "lucide-react";
import { Link } from "react-router-dom";

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
  status: string;
  published_at: string | null;
  created_at: string;
};

export default function AdminSEO() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [savingArticle, setSavingArticle] = useState(false);

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

  const wrapOrInsertAtCursor = (before: string, after = "", placeholder = "") => {
    const ta = bodyRef.current;
    if (!ta || !editingArticle) return;
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    const value = ta.value;
    const selected = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    setEditingArticle({ ...editingArticle, body_markdown: next });
    requestAnimationFrame(() => {
      ta.focus();
      const cursor = start + before.length + selected.length;
      ta.setSelectionRange(cursor, cursor);
    });
  };

  const insertHeading = (level: 1 | 2 | 3) => {
    const ta = bodyRef.current;
    if (!ta || !editingArticle) return;
    const hashes = "#".repeat(level);
    const start = ta.selectionStart ?? 0;
    const value = ta.value;
    // ensure heading sits on its own line
    const needsNewlineBefore = start > 0 && value[start - 1] !== "\n";
    wrapOrInsertAtCursor(`${needsNewlineBefore ? "\n" : ""}${hashes} `, "\n", "Heading");
  };

  const insertImagePrompt = () => {
    const url = window.prompt("Paste image or GIF URL (Giphy/Tenor/Media Library):");
    if (!url) return;
    const alt = window.prompt("Alt text (describe the image — include your keyword if natural):", "") || "";
    wrapOrInsertAtCursor(`\n![${alt}](${url.trim()})\n`, "");
  };

  const insertLinkPrompt = () => {
    const url = window.prompt("Link URL:");
    if (!url) return;
    wrapOrInsertAtCursor("[", `](${url.trim()})`, "link text");
  };

  const uploadMediaAndInsert = async (file: File) => {
    if (!editingArticle) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("Max 20MB"); return; }
    setUploadingMedia(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `seo/${editingArticle.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("media").upload(path, file, {
        cacheControl: "31536000", upsert: false, contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("media").getPublicUrl(path);
      const alt = window.prompt("Alt text for this image:", file.name.replace(/\.[^.]+$/, "")) || "";
      wrapOrInsertAtCursor(`\n![${alt}](${data.publicUrl})\n`, "");
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
                      <Button size="sm" variant="outline" onClick={() => setEditingArticle(a)}>
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
            <h3 className="mb-4 text-lg font-semibold">Edit article</h3>
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
                <Textarea value={editingArticle.body_markdown} rows={20}
                  className="font-mono text-xs"
                  onChange={(e) => setEditingArticle({ ...editingArticle, body_markdown: e.target.value })} />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditingArticle(null)}>Cancel</Button>
              <Button onClick={saveArticle} disabled={savingArticle}>
                {savingArticle && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
