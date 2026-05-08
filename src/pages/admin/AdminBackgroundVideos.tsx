import { useEffect, useRef, useState } from 'react';
import { Loader2, Trash2, Upload, Film, Copy, Check } from 'lucide-react';
import { AdminHeader } from './AdminDashboard';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const BUCKET = 'background-videos';

type VideoFile = {
  name: string;
  size: number | null;
  updatedAt: string | null;
  publicUrl: string;
};

const fmtBytes = (n: number | null) => {
  if (!n && n !== 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

const AdminBackgroundVideos = () => {
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.storage.from(BUCKET).list('', {
      sortBy: { column: 'updated_at', order: 'desc' },
      limit: 100,
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const rows: VideoFile[] = (data ?? [])
      .filter((f) => f.name && f.name !== '.emptyFolderPlaceholder')
      .map((f) => ({
        name: f.name,
        size: (f.metadata as any)?.size ?? null,
        updatedAt: f.updated_at ?? f.created_at ?? null,
        publicUrl: supabase.storage.from(BUCKET).getPublicUrl(f.name).data.publicUrl,
      }));
    setVideos(rows);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast.error('Please choose a video file');
      return;
    }
    setUploading(true);
    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error } = await supabase.storage.from(BUCKET).upload(safeName, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    });
    setUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Video uploaded');
    load();
  };

  const handleDelete = async (name: string) => {
    setConfirmDelete(null);
    const { error } = await supabase.storage.from(BUCKET).remove([name]);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Video deleted');
    setVideos((v) => v.filter((x) => x.name !== name));
  };

  const copyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 1500);
    toast.success('URL copied');
  };

  return (
    <>
      <AdminHeader
        title="Background Videos"
        subtitle="Upload, preview, and delete videos used as page backgrounds"
        action={
          <>
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="font-bold"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {uploading ? 'Uploading…' : 'Upload Video'}
            </Button>
          </>
        }
      />

      <div className="p-4 sm:p-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : videos.length === 0 ? (
          <div className="tactical-card p-10 text-center">
            <Film className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-bold mb-1">No background videos yet</p>
            <p className="text-sm text-muted-foreground">
              Upload an MP4/WebM to use as a page background.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((v) => (
              <div key={v.name} className="tactical-card overflow-hidden">
                <video
                  src={v.publicUrl}
                  className="w-full aspect-video bg-black object-cover"
                  controls
                  muted
                  playsInline
                  preload="metadata"
                />
                <div className="p-3 space-y-2">
                  <div className="font-semibold text-sm truncate" title={v.name}>
                    {v.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                    <span>{fmtBytes(v.size)}</span>
                    <span>{v.updatedAt ? new Date(v.updatedAt).toLocaleDateString() : '—'}</span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => copyUrl(v.publicUrl)}
                    >
                      {copied === v.publicUrl ? (
                        <Check className="h-3.5 w-3.5 mr-1" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 mr-1" />
                      )}
                      Copy URL
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setConfirmDelete(v.name)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this video?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono">{confirmDelete}</span> will be permanently removed.
              Any pages embedding it will break.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AdminBackgroundVideos;
