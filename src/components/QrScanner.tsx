import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Upload, AlertTriangle, Loader2 } from "lucide-react";

// Real camera QR scanning (getUserMedia + jsQR, decoded frame-by-frame on a
// canvas) with an image-upload fallback for browsers/devices where camera
// access isn't available or permission is denied. Never claims a decoded
// payload is a valid/payable UPI request — it only hands the raw decoded
// string back to the caller, which is responsible for parsing/validating it.
export function QrScanner({ onDecode }: { onDecode: (raw: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraState, setCameraState] = useState<"starting" | "active" | "unavailable">("starting");
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState("unavailable");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraState("active");
        scanLoop();
      } catch {
        // Permission denied, no camera hardware, insecure context, etc. —
        // the image-upload fallback below remains available either way.
        setCameraState("unavailable");
      }
    }

    function scanLoop() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(scanLoop);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) {
        onDecode(code.data);
        return; // stop the loop — caller will unmount/replace this component
      }
      rafRef.current = requestAnimationFrame(scanLoop);
    }

    startCamera();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setUploadError("");

    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas unavailable");
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (!code?.data) {
        setUploadError("No QR code found in that image.");
        return;
      }
      onDecode(code.data);
    } catch {
      setUploadError("Couldn't read that image.");
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative mb-4 flex h-64 w-64 items-center justify-center overflow-hidden rounded-3xl bg-neutral-900">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" style={{ display: cameraState === "active" ? "block" : "none" }} />
        <canvas ref={canvasRef} className="hidden" />
        {cameraState === "starting" && <Loader2 className="h-8 w-8 animate-spin text-white/70" />}
        {cameraState === "unavailable" && (
          <div className="px-6 text-center text-xs text-white/70">
            <AlertTriangle className="mx-auto mb-2 h-6 w-6" />
            Camera isn't available — use the upload option below instead.
          </div>
        )}
        {cameraState === "active" && (
          <>
            <span className="pointer-events-none absolute left-6 top-6 h-8 w-8 rounded-tl-2xl border-l-2 border-t-2 border-white/80" />
            <span className="pointer-events-none absolute right-6 top-6 h-8 w-8 rounded-tr-2xl border-r-2 border-t-2 border-white/80" />
            <span className="pointer-events-none absolute bottom-6 left-6 h-8 w-8 rounded-bl-2xl border-b-2 border-l-2 border-white/80" />
            <span className="pointer-events-none absolute bottom-6 right-6 h-8 w-8 rounded-br-2xl border-b-2 border-r-2 border-white/80" />
          </>
        )}
      </div>

      <p className="mb-3 text-sm text-neutral-500">
        {cameraState === "active" ? "Point your camera at a UPI QR code" : "Upload a photo of a UPI QR code"}
      </p>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-2 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
      >
        <Upload className="h-4 w-4" />
        Upload image instead
      </button>
      {uploadError && <p className="mt-2 text-xs font-medium text-red-600">{uploadError}</p>}
    </div>
  );
}
