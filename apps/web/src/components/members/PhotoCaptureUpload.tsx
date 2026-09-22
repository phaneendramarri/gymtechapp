import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Trash2, User, RefreshCw, ScanFace, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { compressAndConvertToBase64 } from '@/lib/image';
import { extractFaceDescriptor, serializeDescriptor, loadFaceApiModels } from '@/lib/face-api';
import { cn } from '@/lib/utils';

interface PhotoCaptureUploadProps {
  value?: string;
  onChange: (base64Url: string) => void;
  onFaceDescriptorGenerated?: (descriptorJson: string) => void;
  label?: string;
}

export const PhotoCaptureUpload: React.FC<PhotoCaptureUploadProps> = ({
  value,
  onChange,
  onFaceDescriptorGenerated,
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
  const [faceStatus, setFaceStatus] = useState<'idle' | 'detecting' | 'detected' | 'not_detected'>('idle');
  const { toast } = useToast();

  // Pre-warm face-api models when user interacts or mounts
  useEffect(() => {
    loadFaceApiModels().catch(() => {});
  }, []);

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
    setFaceStatus('detecting');
    try {
      // Read dimensions before compression
      const probeUrl = URL.createObjectURL(file);
      const probe = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = probeUrl;
      });
      setImgDims({ w: probe.naturalWidth, h: probe.naturalHeight });

      // Run face detection on the original image
      const descriptor = await extractFaceDescriptor(probe);
      URL.revokeObjectURL(probeUrl);

      const result = await compressAndConvertToBase64(file, { maxWidth: 300, maxHeight: 300, quality: 0.75 });
      onChange(result.base64);
      setFileSizeKb(Math.round(result.sizeBytes / 1024));

      if (descriptor) {
        setFaceStatus('detected');
        const serialized = serializeDescriptor(descriptor);
        if (onFaceDescriptorGenerated) {
          onFaceDescriptorGenerated(serialized);
        }
        toast('success', 'Face Detected', 'Biometric template generated successfully for Face ID check-in.');
      } else {
        setFaceStatus('not_detected');
        toast('info', 'Photo uploaded', 'No clear face detected in this photo. For Face ID check-in, use a clear front-facing portrait.');
      }
    } catch (err) {
      console.error('Failed to process image:', err);
      setFaceStatus('idle');
      toast('error', 'Upload failed', 'Could not process this image. Try a JPG or PNG under 2 MB.');
    } finally {
      setIsProcessing(false);
    }
  };

  const startWebcam = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      setStream(mediaStream);
      setIsCapturingWebcam(true);
      loadFaceApiModels().catch(() => {});
    } catch (err) {
      console.error('Camera error:', err);
      toast('error', 'Camera unavailable', 'Camera access was not granted or is unavailable on this device.');
    }
  };

  const snapPhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 320;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/webp', 0.8);
    onChange(base64);
    setFileSizeKb(Math.round((base64.length * 3) / 4096));
    setImgDims({ w: canvas.width, h: canvas.height });

    stopWebcam();

    // Extract descriptor from the captured canvas
    setIsProcessing(true);
    setFaceStatus('detecting');
    try {
      const descriptor = await extractFaceDescriptor(canvas);
      if (descriptor) {
        setFaceStatus('detected');
        const serialized = serializeDescriptor(descriptor);
        if (onFaceDescriptorGenerated) {
          onFaceDescriptorGenerated(serialized);
        }
        toast('success', 'Face Registered', 'Biometric face descriptor saved for front-desk check-in!');
      } else {
        setFaceStatus('not_detected');
        toast('info', 'Photo captured', 'Face not clearly detected. You can keep this photo or retake with better lighting.');
      }
    } catch (err) {
      console.error('Face descriptor error on snap:', err);
      setFaceStatus('idle');
    } finally {
      setIsProcessing(false);
    }
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
    setFaceStatus('idle');
    if (onFaceDescriptorGenerated) {
      onFaceDescriptorGenerated('');
    }
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
          className="relative w-24 sm:w-28 aspect-[3/4] rounded-xl border-2 border-border bg-card overflow-hidden flex items-center justify-center shrink-0 shadow-xs"
        >
          {isCapturingWebcam ? (
            <>
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
                className="size-full object-cover transform -scale-x-100"
              />
              {/* Face alignment guideline overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-16 h-22 rounded-[50%] border-2 border-dashed border-primary/60 animate-pulse" />
              </div>
            </>
          ) : value ? (
            <img src={value} alt="Member Photo" className="size-full object-cover" />
          ) : (
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <User className="size-8 opacity-50" />
            </div>
          )}

          {isProcessing && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-1.5 p-2 text-center">
              <RefreshCw className="size-5 animate-spin text-primary" />
              <span className="text-[10px] font-mono">Analyzing Face...</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex-1 flex flex-col gap-2.5 w-full">
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
              "rounded-lg border-2 border-dashed p-3 text-center transition-colors cursor-pointer",
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
              <span className="font-semibold text-foreground">Drop a portrait</span> or click to upload
            </p>
            <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
              Used for member identification & Face ID biometric check-in
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
                <span>Snap & Generate Biometric ID</span>
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
                onClick={startWebcam}
                className="text-xs h-8 gap-1.5 border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 font-medium"
              >
                <Camera className="size-3.5" />
                <span>Capture with Webcam</span>
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs h-8 gap-1.5 border-border bg-card hover:bg-secondary"
              >
                <Upload className="size-3.5" />
                <span>Upload File</span>
              </Button>

              {value && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={clearPhoto}
                  className="text-xs h-8 text-destructive hover:bg-destructive/10 px-2 ml-auto"
                  title="Remove Photo"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          )}

          {/* Biometric Status & Metadata Badges */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap pt-0.5">
            {faceStatus === 'detected' && (
              <Badge variant="outline" className="text-[10px] font-mono bg-ok/10 text-ok border-ok/30 flex items-center gap-1">
                <CheckCircle2 className="size-3" />
                Face Descriptor Ready (128-D)
              </Badge>
            )}

            {faceStatus === 'not_detected' && (
              <Badge variant="outline" className="text-[10px] font-mono bg-warn/10 text-warn border-warn/30 flex items-center gap-1">
                <AlertCircle className="size-3" />
                No face detected (Retake for Face ID)
              </Badge>
            )}

            {fileSizeKb !== null && (
              <span className="font-mono text-[10px] text-muted-foreground">
                {fileSizeKb} KB
              </span>
            )}
            {imgDims && (
              <span className="font-mono text-[10px] text-muted-foreground">
                {imgDims.w}×{imgDims.h}
              </span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
