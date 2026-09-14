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

  const isDetectingRef = useRef(false);
  const [manualCode, setManualCode] = useState('');

  const captureFrame = async () => {
    if (!videoRef.current || isDetectingRef.current || scanSuccess) return;
    const video = videoRef.current;
    if (video.readyState < 2) return;

    // Use native browser BarcodeDetector if available
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        isDetectingRef.current = true;
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const barcodes = await detector.detect(video);
        if (barcodes.length > 0 && barcodes[0]?.rawValue) {
          handleScan(barcodes[0].rawValue);
          return;
        }
      } catch (err) {
        // Frame detection error fallback
      } finally {
        isDetectingRef.current = false;
      }
    }
  };

  const handleScan = (data: string) => {
    if (!data.trim() || scanSuccess) return;
    setScanSuccess(true);
    setTimeout(() => {
      onScan(data.trim());
      stopCamera();
    }, 400);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleScan(manualCode.trim());
    }
  };

  // Start scanning frames
  useEffect(() => {
    if (!hasPermission || !videoRef.current) return;
    const interval = setInterval(captureFrame, 350); // Scan every 350ms
    return () => clearInterval(interval);
  }, [hasPermission, scanSuccess]);

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

          <form onSubmit={handleManualSubmit} className="mt-3 flex gap-2">
            <input
              type="text"
              placeholder="Or enter / scan QR code payload here..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              disabled={isProcessing}
              className="flex-1 px-3 py-1.5 text-xs bg-muted/40 border border-border rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button type="submit" size="sm" disabled={!manualCode.trim() || isProcessing} className="text-xs h-8">
              Check In
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-3">
            Note: Camera or barcode scanner access is required to check in. Video is processed locally on-device.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
