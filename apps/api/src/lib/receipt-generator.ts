// Payment Receipt HTML Template
// This generates a printable receipt for gym payments

export interface ReceiptData {
  receiptNumber: string;
  paymentDate: number;
  memberName: string;
  memberCode: string;
  phone: string;
  amountPaise: number;
  paymentMode: string;
  referenceId?: string;
  planName?: string;
  notes?: string;
  gymName: string;
  gymPhone: string;
  gymAddress?: string;
  gymEmail?: string;
  gstNumber?: string;
}

export function generateReceiptHTML(data: ReceiptData): string {
  const date = new Date(data.paymentDate * 1000).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const time = new Date(data.paymentDate * 1000).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const amount = (data.amountPaise / 100).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt - ${data.receiptNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      background: #f5f5f5;
      padding: 20px;
    }
    .receipt {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 28px;
      color: #2563eb;
      margin-bottom: 5px;
    }
    .header p {
      font-size: 14px;
      color: #666;
    }
    .receipt-number {
      text-align: center;
      font-size: 20px;
      font-weight: bold;
      color: #2563eb;
      margin-bottom: 30px;
      padding: 10px;
      background: #eff6ff;
      border-radius: 4px;
    }
    .section {
      margin-bottom: 25px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }
    .info-item {
      display: flex;
      flex-direction: column;
    }
    .info-label {
      font-size: 12px;
      color: #666;
      margin-bottom: 3px;
    }
    .info-value {
      font-size: 15px;
      font-weight: 500;
      color: #1a1a1a;
    }
    .amount-section {
      background: #f9fafb;
      border: 2px dashed #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin: 30px 0;
    }
    .amount-label {
      font-size: 14px;
      color: #666;
      margin-bottom: 5px;
    }
    .amount-value {
      font-size: 36px;
      font-weight: bold;
      color: #2563eb;
    }
    .payment-details {
      background: #eff6ff;
      border-radius: 6px;
      padding: 15px;
      margin-top: 20px;
    }
    .payment-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #dbeafe;
    }
    .payment-row:last-child {
      border-bottom: none;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    .footer-note {
      margin-top: 15px;
      padding: 10px;
      background: #fef3c7;
      border-radius: 4px;
      font-size: 11px;
      color: #92400e;
    }
    @media print {
      body {
        background: white;
        padding: 0;
      }
      .receipt {
        box-shadow: none;
        padding: 20px;
      }
      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1>${data.gymName}</h1>
      ${data.gymAddress ? `<p>${data.gymAddress}</p>` : ''}
      <p>Phone: ${data.gymPhone}${data.gymEmail ? ` | Email: ${data.gymEmail}` : ''}</p>
      ${data.gstNumber ? `<p>GST No: ${data.gstNumber}</p>` : ''}
    </div>

    <div class="receipt-number">
      Receipt No: ${data.receiptNumber}
    </div>

    <div class="section">
      <div class="section-title">Member Details</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Member Name</div>
          <div class="info-value">${data.memberName}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Member Code</div>
          <div class="info-value">${data.memberCode}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Phone</div>
          <div class="info-value">${data.phone}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Payment Date</div>
          <div class="info-value">${date} at ${time}</div>
        </div>
      </div>
    </div>

    <div class="amount-section">
      <div class="amount-label">Amount Paid</div>
      <div class="amount-value">${amount}</div>
    </div>

    <div class="section">
      <div class="section-title">Payment Information</div>
      <div class="payment-details">
        <div class="payment-row">
          <span>Payment Mode</span>
          <strong>${data.paymentMode}</strong>
        </div>
        ${data.referenceId ? `
        <div class="payment-row">
          <span>Reference ID</span>
          <strong>${data.referenceId}</strong>
        </div>
        ` : ''}
        ${data.planName ? `
        <div class="payment-row">
          <span>Plan</span>
          <strong>${data.planName}</strong>
        </div>
        ` : ''}
        ${data.notes ? `
        <div class="payment-row">
          <span>Notes</span>
          <strong>${data.notes}</strong>
        </div>
        ` : ''}
      </div>
    </div>

    <div class="footer">
      <p>Thank you for being a valued member!</p>
      <p>For any queries, please contact us at ${data.gymPhone}</p>
      <div class="footer-note">
        This is a computer-generated receipt. Please keep it for your records.
      </div>
    </div>
  </div>

  <script>
    // Auto-print dialog on load (optional)
    // window.onload = () => window.print();
  </script>
</body>
</html>
  `.trim();
}

export function generateReceiptURL(data: ReceiptData): string {
  const html = generateReceiptHTML(data);
  const blob = new Blob([html], { type: 'text/html' });
  return URL.createObjectURL(blob);
}
