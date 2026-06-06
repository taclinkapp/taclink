import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload, RefreshCw, Trash2, Image as ImageIcon, Sparkles } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Asset = {
  id: string;
  filename: string;
  storage_path: string;
  public_url: string;
  mime_type: string;
  file_size: number | null;
  alt_text: string | null;
  ai_description: string | null;
  seo_score: number;
  tags: string[];
  category: string | null;
  usage_count: number;
  analyzed_at: string | null;
  analysis_error: string | null;
  created_at: string;
};

const ACCEPTED = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
const MAX_BYTES = 20 * 1024 * 1024;

function scoreBadge(score: number) {
  if (score >= 70) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
  if (score >= 40) return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
  return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
}

function formatBytes(n: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function AdminMedia() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState("newest");
  const [filterCategory, setFilterCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("media_assets")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setAssets((data ?? []) as Asset[]);

    // Generate signed URLs in parallel (1h)
    const paths = (data ?? []).map((a: Asset) => a.storage_path);
    if (paths.length) {
      const { data: signed } = await supabase.storage
        .from("media-library")
        .createSignedUrls(paths, 3600);
      const map: Record<string, string> = {};
      signed?.forEach((s, i) => { if (s.signedUrl) map[paths[i]] = s.signedUrl; });
      setSignedUrls(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const analyze = useCallback(async (id: string) => {
    setAnalyzingIds((s) => new Set(s).add(id));
    try {
      const { data, error } = await supabase.functions.invoke("media-analyze", { body: { id } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Scored ${data?.seo_score ?? "?"}/100`);
      await load();
    } catch (e: any) {
      toast.error(`Analysis failed: ${e.message ?? e}`);
    } finally {
      setAnalyzingIds((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  }, [load]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not signed in"); return; }

    setUploading(true);
    let uploaded = 0;
    for (const file of list) {
      if (!ACCEPTED.includes(file.type)) {
        toast.error(`${file.name}: unsupported type`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: over 20MB`);
        continue;
      }
      const ext = file.name.split(".").pop() || "bin";
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${crypto.randomUUID()}_${safeName}`.slice(0, 200) + (safeName.endsWith(ext) ? "" : `.${ext}`);

      const { error: upErr } = await supabase.storage
        .from("media-library")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) { toast.error(`${file.name}: ${upErr.message}`); continue; }

      const { data: row, error: insErr } = await supabase
        .from("media_assets")
        .insert({
          filename: file.name,
          storage_path: path,
          public_url: path,
          mime_type: file.type,
          file_size: file.size,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (insErr || !row) {
        toast.error(`${file.name}: ${insErr?.message}`);
        await supabase.storage.from("media-library").remove([path]);
        continue;
      }

      uploaded++;
      // Fire-and-forget analysis
      analyze(row.id);
    }
    if (uploaded) toast.success(`Uploaded ${uploaded} file${uploaded === 1 ? "" : "s"} — analyzing…`);
    setUploading(false);
    await load();
  }, [analyze, load]);

  const handleDelete = useCallback(async (asset: Asset) => {
    setDeleteTarget(null);
    const { error: stErr } = await supabase.storage.from("media-library").remove([asset.storage_path]);
    if (stErr) toast.error(`Storage: ${stErr.message}`);
    const { error: dbErr } = await supabase.from("media_assets").delete().eq("id", asset.id);
    if (dbErr) { toast.error(dbErr.message); return; }
    toast.success("Deleted");
    setAssets((a) => a.filter((x) => x.id !== asset.id));
  }, []);

  const categories = Array.from(new Set(assets.map((a) => a.category).filter(Boolean))) as string[];

  const filtered = assets
    .filter((a) => filterCategory === "all" || a.category === filterCategory)
    .filter((a) => !search || a.filename.toLowerCase().includes(search.toLowerCase())
      || a.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())));

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "score") return b.seo_score - a.seo_score;
    if (sortBy === "used") return b.usage_count - a.usage_count;
    if (sortBy === "name") return a.filename.localeCompare(b.filename);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Media Library</h1>
        <p className="text-muted-foreground mt-1">
          Upload GIFs and images. AI scores each one for SEO so the article generator can pick the best visuals.
        </p>
      </div>

      {/* Upload zone */}
      <Card
        className={`border-2 border-dashed p-8 transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-border"
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-full bg-primary/10 p-3">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-medium">Drag &amp; drop images or GIFs</p>
            <p className="text-sm text-muted-foreground">PNG, JPG, GIF, WebP — up to 10MB each</p>
          </div>
          <label>
            <input
              type="file"
              accept={ACCEPTED.join(",")}
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              disabled={uploading}
            />
            <Button asChild disabled={uploading}>
              <span>{uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}Choose files</span>
            </Button>
          </label>
        </div>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Search filename or tag…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Sort by" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="score">Highest score</SelectItem>
            <SelectItem value="used">Most used</SelectItem>
            <SelectItem value="name">Filename (A–Z)</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto text-sm text-muted-foreground">
          {sorted.length} of {assets.length}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : sorted.length === 0 ? (
        <Card className="p-12 text-center">
          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No media yet. Upload your first GIF or screenshot above.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sorted.map((a) => {
            const url = signedUrls[a.storage_path];
            const isAnalyzing = analyzingIds.has(a.id);
            return (
              <Card key={a.id} className="overflow-hidden flex flex-col group">
                <div className="aspect-video bg-muted relative overflow-hidden">
                  {url ? (
                    <img
                      src={url}
                      alt={a.alt_text ?? a.filename}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                  <Badge className={`absolute top-2 right-2 border ${scoreBadge(a.seo_score)}`}>
                    {a.analyzed_at ? `${a.seo_score}` : "—"}
                  </Badge>
                </div>
                <div className="p-3 flex flex-col gap-2 flex-1">
                  <div className="text-sm font-medium truncate" title={a.filename}>{a.filename}</div>
                  {a.category && <Badge variant="secondary" className="w-fit text-xs">{a.category}</Badge>}
                  {a.ai_description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{a.ai_description}</p>
                  )}
                  {a.analysis_error && (
                    <p className="text-xs text-destructive line-clamp-2">⚠ {a.analysis_error}</p>
                  )}
                  {a.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {a.tags.slice(0, 4).map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-2">
                    <span>{formatBytes(a.file_size)}</span>
                    <span>Used {a.usage_count}×</span>
                  </div>
                  <div className="flex gap-1 pt-1">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => analyze(a.id)} disabled={isAnalyzing}>
                      {isAnalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      <span className="ml-1">{a.analyzed_at ? "Re-score" : "Score"}</span>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(a)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete media asset?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {deleteTarget?.filename} from storage and the library. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && handleDelete(deleteTarget)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
