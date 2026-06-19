import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Loader2, X, RefreshCw, Camera } from 'lucide-react';

type Props = {
  onDecode: (text: string) => void;
  onClose: () => void;
};

type CamInfo = { id: string; label: string };

// Pick the best rear camera. Android often returns several "environment"
// cameras (wide, ultra-wide, tele). The plain "back camera" without a
// modifier is the most reliable for QR decoding.
const pickRearCamera = (cams: CamInfo[]): string | null => {
  if (cams.length === 0) return null;
  const rear = cams.filter((c) => /back|rear|environment/i.test(c.label));
  if (rear.length === 0) return cams[cams.length - 1].id; // last is usually back on Android
  const plain = rear.find(
    (c) => !/wide|ultra|tele|zoom|depth|macro/i.test(c.label),
  );
  return (plain ?? rear[0]).id;
};

export const QrScanner = ({ onDecode, onClose }: Props) => {
  const containerId =
    'qr-scanner-' + useRef(Math.random().toString(36).slice(2)).current;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const decodedOnce = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [cameras, setCameras] = useState<CamInfo[]>([]);
  const [activeCamId, setActiveCamId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const stopExisting = async () => {
      const s = scannerRef.current;
      if (!s) return;
      try {
        await s.stop();
      } catch {
        /* ignore */
      }
      try {
        s.clear();
      } catch {
        /* ignore */
      }
      scannerRef.current = null;
    };

    const start = async () => {
      setError(null);
      setStarting(true);
      await stopExisting();

      // getUserMedia must be primed before Html5Qrcode.getCameras() returns
      // useful labels on Android Chrome. Without this the labels are blank
      // and pickRearCamera can't tell the rear lens from the selfie cam.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        stream.getTracks().forEach((t) => t.stop());
      } catch (e: any) {
        if (cancelled) return;
        setError(
          e?.name === 'NotAllowedError'
            ? 'Camera permission denied. Enable camera access for taclink.app in your browser settings, then try again.'
            : e?.message ?? 'Could not access camera.',
        );
        setStarting(false);
        return;
      }

      let camList: CamInfo[] = [];
      try {
        camList = await Html5Qrcode.getCameras();
      } catch {
        camList = [];
      }
      if (cancelled) return;
      setCameras(camList);

      const chosenId =
        activeCamId && camList.some((c) => c.id === activeCamId)
          ? activeCamId
          : pickRearCamera(camList);

      try {
        const scanner = new Html5Qrcode(containerId, { verbose: false });
        scannerRef.current = scanner;
        const startTarget: any = chosenId
          ? chosenId
          : { facingMode: { ideal: 'environment' } };
        await scanner.start(
          startTarget,
          {
            fps: 10,
            qrbox: (vw: number, vh: number) => {
              const s = Math.floor(Math.min(vw, vh) * 0.7);
              return { width: s, height: s };
            },
            aspectRatio: 1.0,
            // Android Chrome often falls back to a software decoder when
            // BarcodeDetector isn't enabled. Allow it explicitly.
            experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          } as any,
          (decodedText) => {
            if (decodedOnce.current) return;
            decodedOnce.current = true;
            onDecode(decodedText);
          },
          () => {
            /* ignore decode misses */
          },
        );
        if (cancelled) {
          await stopExisting();
          return;
        }
        if (chosenId) setActiveCamId(chosenId);
        setStarting(false);
      } catch (e: any) {
        if (cancelled) return;
        setError(
          e?.message ??
            'Could not start camera. Tap retry, or pick a different camera below.',
        );
        setStarting(false);
      }
    };

    start();

    return () => {
      cancelled = true;
      stopExisting();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, activeCamId]);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      <div className="flex items-center justify-between p-4 text-white">
        <div className="text-sm font-bold uppercase tracking-wider">
          Scan student QR
        </div>
        <button
          onClick={onClose}
          className="h-9 w-9 rounded-md bg-white/10 flex items-center justify-center"
          aria-label="Close scanner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative w-full max-w-sm aspect-square rounded-md overflow-hidden bg-black">
          <div
            id={containerId}
            className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full"
          />
          {starting && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-white text-xs">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Starting camera…
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-destructive text-xs p-4 text-center gap-3">
              <div className="leading-relaxed">{error}</div>
              <button
                type="button"
                onClick={() => setAttempt((n) => n + 1)}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-white/10 text-white text-xs font-bold"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </button>
            </div>
          )}
        </div>
      </div>

      {cameras.length > 1 && (
        <div className="px-4 pb-2">
          <label className="text-[10px] uppercase tracking-wider text-white/60 font-bold flex items-center gap-1.5 mb-1.5">
            <Camera className="h-3 w-3" /> Camera
          </label>
          <select
            value={activeCamId ?? ''}
            onChange={(e) => {
              setActiveCamId(e.target.value);
            }}
            className="w-full h-10 rounded-md bg-white/10 text-white text-sm px-2"
          >
            {cameras.map((c) => (
              <option key={c.id} value={c.id} className="bg-black">
                {c.label || `Camera ${c.id.slice(0, 6)}`}
              </option>
            ))}
          </select>
        </div>
      )}

      <p className="text-white/60 text-[11px] text-center pb-6 px-6">
        Point at the student's check-in QR code. Marks attendance automatically.
      </p>
    </div>
  );
};
