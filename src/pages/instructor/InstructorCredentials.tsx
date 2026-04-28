import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell, PageHeader } from "@/components/MobileShell";
import { InstructorTabBar } from "@/components/InstructorTabBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ShieldCheck, Upload, Loader2, FileCheck, AlertTriangle, X, Trash2 } from "lucide-react";

type Credential = {
  id: string;
  credential_type: string;
  display_name: string | null;
  file_path: string;
  file_mime: string | null;
  status: "pending" | "approved" | "needs_review" | "rejected";
  ai_confidence: number | null;
  ai_issuer: string | null;
  ai_holder_name: string | null;
  ai_expires_on: string | null;
  ai_reasons: string | null;
  created_at: string;
};

const TYPES = [
  { value: "nra_instructor", label: "NRA Instructor Certification" },
  { value: "state_license", label: "State Firearms Instructor License" },
  { value: "usconcealed", label: "USCCA / USConcealed Certificate" },
  { value: "military_id", label: "Military ID / DD-214" },
  { value: "le_id", label: "Law Enforcement ID" },
  { value: "rso", label: "Range Safety Officer" },
  { value: "other", label: "Other Credential" },
];

const statusBadge = (s: Credential["status"]) =>
  s === "approved"
    ? "bg-emerald-500 text-white"
    : s === "needs_review"
      ? "bg-amber-500 text-white"
      : s === "rejected"
        ? "bg-destructive text-destructive-foreground"
        : "bg-muted text-muted-foreground";

const InstructorCredentials = () => {
  const { user } = useAuth();
  const [creds, setCreds] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);

  const [type, setType] = useState("nra_instructor");
  const [displayName, setDisplayName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("instructor_credentials")
      .select("*")
      .eq("instructor_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setCreds((data as Credential[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const onPick = (f: File | null) => {
    if (!f) {
      setFile(null);
      setPreview(null);
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Max 10 MB");
      return;
    }
    if (!/^image\/(png|jpe?g|webp|heic)$/i.test(f.type)) {
      toast.error("Use a JPG, PNG, or WEBP image of the credential");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const upload = async () => {
    if (!user || !file) return;
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("credentials")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;

      const { data: row, error: insErr } = await supabase
        .from("instructor_credentials")
        .insert({
          instructor_id: user.id,
          credential_type: type,
          display_name: displayName || null,
          file_path: path,
          file_mime: file.type,
          status: "pending",
        })
        .select()
        .single();
      if (insErr) throw insErr;

      toast.success("Uploaded — AI scanning…");
      supabase.functions
        .invoke("verify-credential", { body: { credentialId: row.id } })
        .then(({ error }) => {
          if (error) toast.error(`AI scan failed: ${error.message}`);
          load();
        });

      setFile(null);
      setPreview(null);
      setDisplayName("");
      if (fileRef.current) fileRef.current.value = "";
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (c: Credential) => {
    if (!confirm("Delete this credential?")) return;
    await supabase.storage.from("credentials").remove([c.file_path]);
    await supabase.from("instructor_credentials").delete().eq("id", c.id);
    load();
  };

  return (
    <MobileShell>
      <PageHeader title="Credentials" back />
      <div className="px-4 pt-3 space-y-4">
        <div className="tactical-card p-4 bg-gradient-to-br from-primary/10 to-transparent">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-bold">AI-verified credentials boost trust</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload a clear photo of your certification. Our AI scans for issuer,
                holder name, and expiration; high-confidence matches are auto-approved.
              </p>
            </div>
          </div>
        </div>

        <div className="tactical-card p-4 space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider">Upload new credential</h3>
          <div>
            <Label className="text-xs">Credential type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Label (optional)</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. NRA Pistol Instructor — 2025"
              className="h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Credential image</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/heic"
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            {preview ? (
              <div className="relative mt-2">
                <img
                  src={preview}
                  alt="preview"
                  className="w-full max-h-56 object-contain rounded-md border border-border bg-muted"
                />
                <button
                  type="button"
                  onClick={() => onPick(null)}
                  className="absolute top-1 right-1 h-7 w-7 rounded-full bg-background/80 backdrop-blur flex items-center justify-center"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-2 w-full border-2 border-dashed border-border rounded-md p-6 flex flex-col items-center gap-2 hover:border-primary/40 transition"
              >
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Tap to choose image (max 10 MB)</span>
              </button>
            )}
          </div>
          <Button
            onClick={upload}
            disabled={!file || uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading…
              </>
            ) : (
              <>Upload & verify with AI</>
            )}
          </Button>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-bold">
            Your credentials
          </h3>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : creds.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-4 text-center">
              No credentials uploaded yet.
            </p>
          ) : (
            creds.map((c) => {
              const typeLabel = TYPES.find((t) => t.value === c.credential_type)?.label ?? c.credential_type;
              return (
                <div key={c.id} className="tactical-card p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    {c.status === "approved" ? (
                      <FileCheck className="h-4 w-4 text-emerald-500" />
                    ) : c.status === "rejected" ? (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {c.display_name || typeLabel}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {typeLabel}
                      </div>
                    </div>
                    <Badge className={statusBadge(c.status)}>
                      {c.status.replace("_", " ")}
                    </Badge>
                  </div>
                  {(c.ai_issuer || c.ai_holder_name || c.ai_expires_on) && (
                    <div className="text-xs text-muted-foreground space-y-0.5 pl-6">
                      {c.ai_issuer && <div>Issuer: <span className="text-foreground">{c.ai_issuer}</span></div>}
                      {c.ai_holder_name && <div>Holder: <span className="text-foreground">{c.ai_holder_name}</span></div>}
                      {c.ai_expires_on && <div>Expires: <span className="text-foreground">{c.ai_expires_on}</span></div>}
                      {c.ai_confidence !== null && (
                        <div>Confidence: <span className="text-foreground">{Math.round((c.ai_confidence ?? 0) * 100)}%</span></div>
                      )}
                    </div>
                  )}
                  {c.ai_reasons && (
                    <p className="text-xs text-muted-foreground pl-6 leading-relaxed">{c.ai_reasons}</p>
                  )}
                  <div className="flex justify-end">
                    <button
                      onClick={() => remove(c)}
                      className="text-[10px] text-destructive uppercase tracking-wider font-bold flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      <InstructorTabBar />
    </MobileShell>
  );
};

export default InstructorCredentials;
