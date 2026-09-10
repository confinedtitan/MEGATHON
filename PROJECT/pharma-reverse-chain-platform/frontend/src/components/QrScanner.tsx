import { useEffect, useRef, useState } from "react";

/**
 * QR/Barcode scanner for batch identification.
 * Uses the browser BarcodeDetector API when available (Chrome/Edge),
 * otherwise falls back to manual entry + photo capture.
 * No native app needed — pure web application.
 */
export function QrScanner({ onScan, label = "Batch number" }: { onScan: (value: string) => void; label?: string }) {
  const [value, setValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const supported =
    typeof window !== "undefined" && "BarcodeDetector" in window;

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      scanLoop();
    } catch {
      setError("Camera unavailable — type the batch number manually.");
    }
  }

  async function scanLoop() {
    try {
      // @ts-expect-error — BarcodeDetector is a browser API, not in TS DOM lib yet
      const detector = new window.BarcodeDetector({ formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a"] });
      const tick = async () => {
        if (!videoRef.current || videoRef.current.readyState !== 4) {
          if (streamRef.current) requestAnimationFrame(tick);
          return;
        }
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes && codes.length > 0 && codes[0].rawValue) {
            const v = String(codes[0].rawValue).toUpperCase().trim();
            setValue(v);
            onScan(v);
            stop();
            return;
          }
        } catch {
          /* keep scanning */
        }
        if (streamRef.current) setTimeout(tick, 300);
      };
      tick();
    } catch {
      setError("Live barcode detection not supported in this browser — type manually or use Chrome/Edge.");
    }
  }

  function stop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  useEffect(() => () => stop(), []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">📷 {label} — QR / barcode scan</p>
      <div className="mt-2 flex gap-2">
        <input
          value={value}
          onChange={(e) => { setValue(e.target.value.toUpperCase()); onScan(e.target.value.toUpperCase()); }}
          placeholder="e.g. NV-AMX-1001"
          className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-slate-900"
        />
        {!scanning ? (
          <button onClick={start} className="shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700">
            📷 Scan
          </button>
        ) : (
          <button onClick={stop} className="shrink-0 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white">
            ■ Stop
          </button>
        )}
      </div>
      {scanning && <video ref={videoRef} className="mt-3 aspect-video w-full rounded-xl bg-black object-cover" playsInline muted />}
      {!supported && !scanning && (
        <p className="mt-2 text-[11px] text-slate-500">Tip: Chrome/Edge on HTTPS enable live camera decoding; otherwise type or paste the code.</p>
      )}
      {error && <p className="mt-2 text-xs font-semibold text-amber-700">{error}</p>}
    </div>
  );
}
