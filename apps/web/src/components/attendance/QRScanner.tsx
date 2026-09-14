// React Component: QR Scanner for Attendance Check-in
import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
  isProcessing?: boolean;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose, isProcessing = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanSuccess, setScanSuccess] = useState(false);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setStream(mediaStream);
      setHasPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Camera access denied:', err);
      setError('Camera access denied. Please enable camera permissions.');
      setHasPermission(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const captureFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    // In production, use a QR code scanning library like 'jsqr'
    // const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // const code = jsQR(imageData.data, imageData.width, imageData.height);
    // if (code) {
    //   handleScan(code.data);
    // }

    // Placeholder: show success and call onScan with mock data
    // Remove this in production
    console.log('Frame captured, QR scanning would happen here');
  };

  const handleScan = (data: string) => {
    setScanSuccess(true);
    setTimeout(() => {
      onScan(data);
      stopCamera();
    }, 500);
  };

  // Start scanning frames (call this on mount in production)
  useEffect(() => {
    if (!hasPermission || !videoRef.current) return;
    const interval = setInterval(captureFrame, 500); // Scan every 500ms
    return () => clearInterval(interval);
  }, [hasPermission]);

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Scan QR Code</h3>
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isProcessing}>
              <X className="size-4" />
            </Button>
          </div>

          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : scanSuccess ? (
            <Alert className="mb-4 bg-green-50 border-green-200 text-green-800">
              <CheckCircle2 className="size-4 text-green-600" />
              <AlertDescription>QR Code detected! Processing...</AlertDescription>
            </Alert>
          ) : (
            <Alert className="mb-4">
              <Camera className="size-4" />
              <AlertDescription>Position the QR code within the frame</AlertDescription>
            </Alert>
          )}

          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            {hasPermission && (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            )}

            {/* Scanning overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 border-4 border-blue-500 rounded-lg relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white"></div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isProcessing} className="flex-1">
              Cancel
            </Button>
            <Button onClick={startCamera} disabled={isProcessing || hasPermission === true} className="flex-1">
              <Camera className="size-4 mr-2" />
              {hasPermission ? 'Camera Active' : 'Enable Camera'}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Note: Camera access is required to scan QR codes. Your privacy is protected - video is not recorded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
