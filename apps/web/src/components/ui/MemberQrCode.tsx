import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { RefreshCw, QrCode, Download, Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MemberQrCodeProps {
  value: string;
  memberCode: string;
  size?: number;
  className?: string;
}

export const MemberQrCode: React.FC<MemberQrCodeProps> = ({
  value,
  memberCode,
  size = 200,
  className = '',
}) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(value, {
      width: size * 2, // 2x for sharp retina displays
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (isMounted) setDataUrl(url);
      })
      .catch((err) => {
        console.error('QR code generation failed:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [value, size]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(memberCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${memberCode}_checkin_qr.png`;
    a.click();
  };

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div className="relative p-3.5 bg-white rounded-lg border-2 border-border shadow-md flex items-center justify-center">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={`Check-in QR for ${memberCode}`}
            width={size}
            height={size}
            className="block rounded-sm aspect-square"
          />
        ) : (
          <div
            className="flex items-center justify-center text-muted-foreground aspect-square size-48"
          >
            <RefreshCw className="size-6 animate-spin text-primary" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopyCode}
          className="text-xs h-8 gap-1.5 font-mono border-border hover:bg-secondary"
        >
          {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
          <span>{copied ? 'Copied' : memberCode}</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={!dataUrl}
          className="text-xs h-8 gap-1.5 font-mono border-border hover:bg-secondary"
          title="Download QR image"
        >
          <Download className="size-3.5" />
          <span>Save QR</span>
        </Button>
      </div>
    </div>
  );
};
