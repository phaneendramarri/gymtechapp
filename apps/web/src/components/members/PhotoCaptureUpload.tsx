import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Trash2, User, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { compressAndConvertToBase64 } from '@/lib/image';
import { cn } from '@/lib/utils';

interface PhotoCaptureUploadProps {
  value?: string;
  onChange: (base64Url: string) => void;
  label?: string;
}

export const PhotoCaptureUpload: React.FC<PhotoCaptureUploadProps> = ({
  value,
  onChange,
  label = 'Member Profile Photo',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isCapturingWebcam, setIsCapturingWebcam] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileSizeKb, setFileSizeKb] = useState<number | null>(null);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const { toast } = useToast();

  // Safely attach stream to video element when webcam activates
  useEffect(() => {
    if (isCapturingWebcam && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((err) => {
        console.warn('Webcam video play auto-start error:', err);
      });
    }
  }, [isCapturingWebcam, stream]);

  // Clean up media tracks when component unmounts
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    try {
      // Read dimensions before compression for the readout.
      const probeUrl = URL.createObjectURL(file);
      const probe = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = probeUrl;
      });
      setImgDims({ w: probe.naturalWidth, h: probe.naturalHeight });
      URL.revokeObjectURL(probeUrl);

      const result = await compressAndConvertToBase64(file, { maxWidth: 300, maxHeight: 300, quality: 0.75 });
      onChange(result.base64);
      setFileSizeKb(Math.round(result.sizeBytes / 1024));
      toast('success', 'Photo uploaded', `${file.name} ready.`);
    } catch (err) {
      console.error('Failed to compress image:', err);
      toast('error', 'Upload failed', 'Could not process this image. Try a JPG or PNG under 2 MB.');
    } finally {
      setIsProcessing(false);
    }
  };

  const startWebcam = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 320, facingMode: 'user' },
        audio: false,
      });
      setStream(mediaStream);
      setIsCapturingWebcam(true);
    } catch (err) {
      console.error('Camera error:', err);
      toast('error', 'Camera unavailable', 'Camera access was not granted or is unavailable on this device.');
    }
  };

  const snapPhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, 300, 300);
      const base64 = canvas.toDataURL('image/webp', 0.75);
      onChange(base64);
      setFileSizeKb(Math.round((base64.length * 3) / 4096));
    }
    stopWebcam();
  };

  const stopWebcam = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCapturingWebcam(false);
  };

  const clearPhoto = () => {
    onChange('');
    setFileSizeKb(null);
    setImgDims(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-xs font-semibold text-foreground">{label}</span>

      <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-lg border border-border bg-secondary/50">

        {/* Avatar Display Frame (3:4) */}
        <div
          className="relative w-20 sm:w-24 aspect-[3/4] rounded-lg border-2 border-border bg-card overflow-hidden flex items-center justify-center shrink-0 shadow-xs"
        >
          {isCapturingWebcam ? (
            <video
              ref={(el) => {
                videoRef.current = el;
                if (el && stream && el.srcObject !== stream) {
                  el.srcObject = stream;
                  el.play().catch(() => {});
                }
              }}
              autoPlay
              playsInline
              muted
              className="size-full object-cover"
            />
          ) : value ? (
            <img src={value} alt="Member Photo" className="size-full object-cover" />
          ) : (
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <User className="size-8 opacity-50" />
            </div>
          )}

          {isProcessing && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white">
              <RefreshCw className="size-5 animate-spin" />
            </div>
          )}

          {/* Click-to-retake hint */}
          {value && !isCapturingWebcam && (
            <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-end justify-center opacity-0 hover:opacity-100">
              <span className="m-1 text-[10px] font-mono text-white bg-black/60 rounded px-1.5 py-0.5">
                Click to retake
              </span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex-1 flex flex-col gap-2 w-full">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Drag-and-drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) processFile(f);
            }}
            className={cn(
              "rounded-lg border-2 border-dashed p-3 text-center transition-colors",
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-border bg-card/40 hover:border-primary/40"
            )}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
          >
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Drop an image</span> or click to upload
            </p>
            <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
              JPG / PNG / WebP · max 2 MB · 3:4 portrait
            </p>
          </div>

          {isCapturingWebcam ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={snapPhoto}
                className="bg-primary text-primary-foreground text-xs font-bold gap-1.5 h-8 flex-1"
              >
                <Camera className="size-3.5" />
                <span>Snap Photo</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={stopWebcam}
                className="text-xs h-8"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs h-8 gap-1.5 border-border bg-card hover:bg-secondary"
              >
                <Upload className="size-3.5" />
                <span>Upload Image</span>
              </Button>
              
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={startWebcam}
                className="text-xs h-8 gap-1.5 border-border bg-card hover:bg-secondary"
              >
                <Camera className="size-3.5" />
                <span>Use Webcam</span>
              </Button>

              {value && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={clearPhoto}
                  className="text-xs h-8 text-destructive hover:bg-destructive/10 px-2"
                  title="Remove Photo"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
            <span>WebP compressed for fast check-in</span>
            {fileSizeKb !== null && (
              <Badge variant="outline" className="text-[10px] font-mono bg-ok/10 text-ok border-ok/30">
                {fileSizeKb} KB
              </Badge>
            )}
            {imgDims && (
              <Badge variant="outline" className="text-[10px] font-mono">
                {imgDims.w} × {imgDims.h}
              </Badge>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
