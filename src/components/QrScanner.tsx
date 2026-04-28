import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Loader2, X } from 'lucide-react';

type Props = {
  onDecode: (text: string) => void;
  onClose: () => void;
};

export const QrScanner = ({ onDecode, onClose }: Props) => {
  const containerId = 'qr-scanner-' + useRef(Math.random().toString(36).slice(2)).current;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const decodedOnce = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const scanner = new Html5Qrcode(containerId, { verbose: false });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            if (decodedOnce.current) return;
            decodedOnce.current = true;
            onDecode(decodedText);
          },
          () => { /* ignore decode misses */ },
        );
        if (cancelled) {
          await scanner.stop().catch(() => {});
        } else {
          setStarting(false);
        }
      } catch (e: any) {
        setError(e?.message ?? 'Could not start camera.');
        setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        Promise.resolve(s.stop()).catch(() => {}).finally(() => {
          try { s.clear(); } catch { /* noop */ }
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      <div className="flex items-center justify-between p-4 text-white">
        <div className="text-sm font-bold uppercase tracking-wider">Scan student QR</div>
        <button onClick={onClose} className="h-9 w-9 rounded-md bg-white/10 flex items-center justify-center">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative w-full max-w-sm aspect-square rounded-md overflow-hidden bg-black">
          <div id={containerId} className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full" />
          {starting && (
            <div className="absolute inset-0 flex items-center justify-center text-white text-xs">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Starting camera…
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center text-destructive text-xs p-4 text-center">
              {error}
            </div>
          )}
        </div>
      </div>
      <p className="text-white/60 text-[11px] text-center pb-6 px-6">
        Point at the student's check-in QR code. Marks attendance automatically.
      </p>
    </div>
  );
};
