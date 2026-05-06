import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * PhotoAdjusterDialog
 * -------------------
 * Lets an instructor zoom and pan a photo inside a fixed-aspect frame so the
 * exported image *fits the box exactly*. The output is a new JPEG `File`
 * matching the chosen aspect ratio and a target pixel size — so the cover
 * card on the course listing always shows the framing the instructor picked.
 *
 * Modes:
 *   - "fit": scale starts at the value that fits the entire image inside the
 *     frame (letterboxed). Good default for covers — nothing is cropped
 *     unless the user zooms in.
 *   - "fill": scale starts at the value that fills the frame (cropped).
 */
export type AdjustAspect = '16:9' | '1:1';

type Props = {
  open: boolean;
  onClose: () => void;
  source: File | string | null;
  aspect: AdjustAspect;
  outputMaxWidth?: number;
  initialMode?: 'fit' | 'fill';
  filename?: string;
  onSave: (file: File) => void;
};

const ASPECT_RATIOS: Record<AdjustAspect, number> = { '16:9': 16 / 9, '1:1': 1 };

export const PhotoAdjusterDialog = ({
  open,
  onClose,
  source,
  aspect,
  outputMaxWidth = 1600,
  initialMode = 'fit',
  filename = 'photo.jpg',
  onSave,
}: Props) => {
  const ratio = ASPECT_RATIOS[aspect];
  const frameW = 480;
  const frameH = Math.round(frameW / ratio);

  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [minScale, setMinScale] = useState(0.1);
  const [fitScale, setFitScale] = useState(0.1);
  const [fillScale, setFillScale] = useState(0.1);
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // Source URL (object URL for File, string passthrough for URLs).
  const sourceUrl = useMemo(() => {
    if (!source) return null;
    if (typeof source === 'string') return source;
    return URL.createObjectURL(source);
  }, [source]);

  useEffect(() => {
    return () => {
      if (sourceUrl && typeof source !== 'string') URL.revokeObjectURL(sourceUrl);
    };
  }, [sourceUrl, source]);

  // Load the image and compute fit/fill scales.
  useEffect(() => {
    if (!open || !sourceUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const fit = Math.min(frameW / img.naturalWidth, frameH / img.naturalHeight);
      const fill = Math.max(frameW / img.naturalWidth, frameH / img.naturalHeight);
      setImgEl(img);
      setFitScale(fit);
      setFillScale(fill);
      setMinScale(fit * 0.5);
      const start = initialMode === 'fill' ? fill : fit;
      setScale(start);
      setOffset({ x: 0, y: 0 });
    };
    img.onerror = () => toast.error('Could not load image for adjustment');
    img.src = sourceUrl;
  }, [open, sourceUrl, frameW, frameH, initialMode]);

  // Drawn image size at current scale.
  const drawnW = imgEl ? imgEl.naturalWidth * scale : 0;
  const drawnH = imgEl ? imgEl.naturalHeight * scale : 0;

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setOffset({
      x: dragRef.current.ox + (e.clientX - dragRef.current.x),
      y: dragRef.current.oy + (e.clientY - dragRef.current.y),
    });
  };
  const onPointerUp = () => { dragRef.current = null; };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    const next = Math.max(minScale, Math.min(scale * (1 + delta), fillScale * 5));
    setScale(next);
  };

  const reset = () => {
    setScale(initialMode === 'fill' ? fillScale : fitScale);
    setOffset({ x: 0, y: 0 });
  };

  const save = async () => {
    if (!imgEl) return;
    setBusy(true);
    try {
      const outW = Math.min(outputMaxWidth, Math.max(800, Math.round(frameW * 3)));
      const outH = Math.round(outW / ratio);
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');
      // Fill background — used when image doesn't cover the frame (fit mode).
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, outW, outH);
      // Map preview-frame coordinates to output canvas.
      const k = outW / frameW;
      const w = drawnW * k;
      const h = drawnH * k;
      const x = (frameW / 2 + offset.x - drawnW / 2) * k;
      const y = (frameH / 2 + offset.y - drawnH / 2) * k;
      ctx.drawImage(imgEl, x, y, w, h);
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.9),
      );
      if (!blob) throw new Error('Export failed (image may be blocked by CORS)');
      const file = new File([blob], filename.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
      onSave(file);
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not save adjustment');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adjust photo</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div
            className="relative mx-auto bg-black/80 overflow-hidden rounded-md select-none touch-none cursor-grab active:cursor-grabbing"
            style={{ width: frameW, maxWidth: '100%', aspectRatio: `${ratio}` }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
          >
            {imgEl && (
              <img
                src={imgEl.src}
                alt=""
                draggable={false}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: drawnW,
                  height: drawnH,
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                  pointerEvents: 'none',
                  maxWidth: 'none',
                }}
              />
            )}
            {/* Aspect overlay border */}
            <div className="absolute inset-0 ring-1 ring-primary/40 pointer-events-none" />
          </div>

          <div className="flex items-center gap-2 px-1">
            <ZoomOut className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[scale]}
              min={minScale}
              max={fillScale * 5}
              step={(fillScale * 5 - minScale) / 200 || 0.01}
              onValueChange={(v) => setScale(v[0])}
              className="flex-1"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="flex items-center justify-between gap-2 text-xs">
            <Button type="button" variant="outline" size="sm" onClick={() => { setScale(fitScale); setOffset({ x: 0, y: 0 }); }}>
              <Maximize2 className="h-3.5 w-3.5 mr-1" /> Fit whole photo
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => { setScale(fillScale); setOffset({ x: 0, y: 0 }); }}>
              Fill frame
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            Drag to reposition · scroll or use the slider to zoom
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="button" onClick={save} disabled={!imgEl || busy}>
            {busy ? 'Saving…' : 'Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoAdjusterDialog;
