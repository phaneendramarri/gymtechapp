import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Trash2, User, RefreshCw, ScanFace, CheckCircle2, AlertCircle, VideoOff, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { compressAndConvertToBase64 } from '@/lib/image';
import {
  extractFaceDescriptor,
  extractDescriptorFromImageUrl,
  serializeDescriptor,
  deserializeDescriptor,
  findBestFaceMatch,
  loadFaceApiModels,
  type EnrolledFaceRecord,
} from '@/lib/face-api';
import { api } from '@/lib/api';
import { speakAnnouncement } from '@/lib/speech';
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
  const streamRef = useRef<MediaStream | null>(null);
  const [isCapturingWebcam, setIsCapturingWebcam] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileSizeKb, setFileSizeKb] = useState<number | null>(null);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [faceStatus, setFaceStatus] = useState<'idle' | 'detecting' | 'detected' | 'not_detected'>('idle');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
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
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const verifyAndEnrollDescriptor = async (desc: Float32Array) => {
    setFaceStatus('detected');
    const serialized = serializeDescriptor(desc);
    if (onFaceDescriptorGenerated) {
      onFaceDescriptorGenerated(serialized);
    }

    // Check for duplicate registered faces in this gym
    try {
      const res = await api.getMembers({ limit: 100, status: 'ACTIVE' });
      const enrolled: EnrolledFaceRecord[] = [];
      for (const m of res.members || []) {
        const d = deserializeDescriptor(m.faceEmbedding);
        if (d) {
          enrolled.push({
            member: {
              id: m.id,
              name: `${m.firstName} ${m.lastName || ''}`.trim(),
              memberCode: m.memberCode,
            },
            descriptor: d,
          });
        }
      }
      if (enrolled.length > 0) {
        const match = findBestFaceMatch(desc, enrolled, 0.58);
        if (match && match.isConfidentMatch) {
          const warnMsg = `Duplicate Face: Matches ${match.member.name} (${match.member.memberCode})`;
          setDuplicateWarning(warnMsg);
          speakAnnouncement(`Duplicate! Face already registered for ${match.member.name}.`);
          toast('info', 'Duplicate Face Warning', warnMsg);
          return;
        }
      }
    } catch {
      // Non-blocking duplicate check
    }

    setDuplicateWarning(null);
    speakAnnouncement('Thank you! Biometric face registered successfully.');
    toast('success', 'Face Registered', 'Biometric template generated successfully for Face ID check-in.');
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setFaceStatus('detecting');
    setDuplicateWarning(null);
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

      let finalDescriptor = descriptor;
      if (!finalDescriptor && result.base64) {
        finalDescriptor = await extractDescriptorFromImageUrl(result.base64);
      }

      if (finalDescriptor) {
        await verifyAndEnrollDescriptor(finalDescriptor);
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
    setDuplicateWarning(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = mediaStream;
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

    // Extract descriptor from the captured canvas
    setIsProcessing(true);
    setFaceStatus('detecting');
    setDuplicateWarning(null);
    try {
      let descriptor = await extractFaceDescriptor(canvas);
      if (!descriptor && base64) {
        descriptor = await extractDescriptorFromImageUrl(base64);
      }
      if (descriptor) {
        await verifyAndEnrollDescriptor(descriptor);
      } else {
        setFaceStatus('not_detected');
        toast('info', 'Photo captured', 'Face not clearly detected. You can keep this photo or retake with better lighting.');
      }
    } catch (err) {
      console.error('Face descriptor error on snap:', err);
      setFaceStatus('idle');
    } finally {
      setIsProcessing(false);
      stopWebcam();
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setStream(null);
    setIsCapturingWebcam(false);
  };

  const clearPhoto = () => {
    stopWebcam();
    onChange('');
    setFileSizeKb(null);
    setImgDims(null);
    setFaceStatus('idle');
    setDuplicateWarning(null);
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
              <button
                type="button"
                onClick={stopWebcam}
                className="absolute top-1.5 right-1.5 size-6 rounded-full bg-black/80 hover:bg-destructive text-white flex items-center justify-center transition-colors shadow-sm z-20 cursor-pointer"
                title="Stop Camera"
              >
                <X className="size-3.5" />
              </button>
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
                variant="destructive"
                onClick={stopWebcam}
                className="text-xs h-8 gap-1.5 font-semibold bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                title="Stop Camera"
              >
                <VideoOff className="size-3.5" />
                <span>Stop Camera</span>
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

            {duplicateWarning && (
              <Badge variant="outline" className="text-[10px] font-mono bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 flex items-center gap-1 font-semibold animate-pulse">
                <AlertTriangle className="size-3 text-amber-600 shrink-0" />
                {duplicateWarning}
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
