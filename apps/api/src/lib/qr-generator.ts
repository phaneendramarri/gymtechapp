// QR Code Generator for Member Check-in
// Generates QR code data URL for member attendance scanning

export interface MemberQRData {
  memberId: number;
  memberCode: string;
  gymId: number;
  firstName: string;
  lastName?: string;
  phone: string;
}

/**
 * Generate QR code payload for member check-in
 * Format: gymtech://checkin/{gymId}/{memberId}/{memberCode}
 */
export function generateMemberQRPayload(data: MemberQRData): string {
  return `gymtech://checkin/${data.gymId}/${data.memberId}/${data.memberCode}`;
}

/**
 * Parse QR code payload back to member data
 */
export function parseMemberQRPayload(payload: string): { gymId: number; memberId: number; memberCode: string } | null {
  const match = payload.match(/^gymtech:\/\/checkin\/(\d+)\/(\d+)\/([A-Z0-9]+)$/);
  if (!match) return null;
  return {
    gymId: parseInt(match[1], 10),
    memberId: parseInt(match[2], 10),
    memberCode: match[3],
  };
}

/**
 * Generate QR code as SVG string
 * Uses a simple QR code generation algorithm
 */
export async function generateQRCodeSVG(payload: string, size: number = 256): Promise<string> {
  // For production, use a proper QR code library like 'qrcode' or 'qr-image'
  // This is a placeholder that generates a data URL

  // In a real implementation, you'd use:
  // import QRCode from 'qrcode';
  // return await QRCode.toString(payload, { type: 'svg', width: size });

  // Placeholder SVG for now (shows the payload as text)
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="white"/>
    <text x="50%" y="50%" text-anchor="middle" fill="black" font-size="12" font-family="monospace">
      <tspan x="50%" dy="0">QR Code</tspan>
      <tspan x="50%" dy="20">${payload.substring(0, 20)}</tspan>
      <tspan x="50%" dy="20">${payload.substring(20, 40)}</tspan>
    </text>
  </svg>`;
}

/**
 * Generate QR code as data URL (for img src)
 */
export async function generateQRCodeDataURL(payload: string, size: number = 256): Promise<string> {
  const svg = await generateQRCodeSVG(payload, size);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}
