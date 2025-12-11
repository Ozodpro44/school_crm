import { Payment, Student, Class } from "@/types";

interface InvoiceData {
  payment: Payment;
  student: Student;
  className: string;
}

export const generateInvoicePDF = (data: InvoiceData) => {
  const { payment, student, className } = data;

  // Create HTML content for the PDF
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice ${payment.invoiceNumber}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'sans-serif';
          line-height: 1.6;
          color: #1e293b;
          background-color: #fff;
        }
        
        .container {
          width: 210mm;
          height: 297mm;
          padding: 40px;
          margin: 0 auto;
          background: white;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 40px;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 20px;
        }
        
        .logo-section {
          flex: 1;
        }
        
        .logo-section h1 {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 5px;
        }
        
        .logo-section p {
          color: #64748b;
          font-size: 14px;
        }
        
        .invoice-info {
          text-align: right;
        }
        
        .invoice-info h2 {
          font-size: 32px;
          font-weight: 700;
          color: #06b6d4;
          margin-bottom: 10px;
        }
        
        .invoice-details {
          font-size: 13px;
          color: #64748b;
        }
        
        .invoice-details p {
          margin: 5px 0;
        }
        
        .details-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          margin: 40px 0;
        }
        
        .detail-block h3 {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          color: #64748b;
          margin-bottom: 10px;
          letter-spacing: 0.5px;
        }
        
        .detail-block p {
          font-size: 14px;
          margin: 5px 0;
        }
        
        .detail-block strong {
          display: block;
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
          margin-top: 5px;
        }
        
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 40px 0;
        }
        
        .items-table thead {
          background-color: #f1f5f9;
        }
        
        .items-table th {
          padding: 12px;
          text-align: left;
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          color: #475569;
          border-bottom: 2px solid #e2e8f0;
        }
        
        .items-table td {
          padding: 12px;
          font-size: 14px;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .items-table td:last-child {
          text-align: right;
        }
        
        .totals-section {
          display: flex;
          justify-content: flex-end;
          margin: 30px 0;
        }
        
        .totals-box {
          width: 300px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 20px;
        }
        
        .total-row {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
          margin-bottom: 10px;
          padding-bottom: 10px;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .total-row:last-child {
          border-bottom: none;
          margin-bottom: 0;
        }
        
        .total-row.final {
          font-weight: 700;
          font-size: 18px;
          color: #06b6d4;
          border-bottom: 2px solid #06b6d4;
          padding-bottom: 10px;
          margin-bottom: 10px;
        }
        
        .status-badge {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          margin-top: 10px;
        }
        
        .status-paid {
          background-color: #dcfce7;
          color: #166534;
        }
        
        .status-unpaid {
          background-color: #fee2e2;
          color: #991b1b;
        }
        
        .status-partial {
          background-color: #fed7aa;
          color: #9a3412;
        }
        
        .footer {
          margin-top: 50px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
          font-size: 12px;
          color: #64748b;
          text-align: center;
        }
        
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          .container {
            width: 100%;
            height: auto;
            padding: 0;
            margin: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo-section">
            <h1>WonderKids School</h1>
            <p>Student Fee Payment Invoice</p>
          </div>
          <div class="invoice-info">
            <h2>INVOICE</h2>
            <div class="invoice-details">
              <p><strong>Invoice Number:</strong><br>${payment.invoiceNumber}</p>
              <p><strong>Issue Date:</strong><br>${new Date().toLocaleDateString()}</p>
              ${payment.paidDate ? `<p><strong>Payment Date:</strong><br>${new Date(payment.paidDate).toLocaleDateString()}</p>` : ''}
            </div>
          </div>
        </div>

        <div class="details-section">
          <div class="detail-block">
            <h3>Student Information</h3>
            <p><strong>${student.fullName}</strong></p>
            <p>Class: ${className}</p>
            <p>Phone: ${student.phone}</p>
            <p>Parent Phone: ${student.parentPhone}</p>
          </div>
          
          <div class="detail-block">
            <h3>Payment Details</h3>
            <p>Period: ${payment.month} ${payment.year}</p>
            <p>Payment Method: <strong style="text-transform: capitalize;">${payment.paymentMethod}</strong></p>
            <p>Status: <span class="status-badge status-${payment.status}">${payment.status}</span></p>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Period</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Monthly Student Fee</td>
              <td>${payment.month} ${payment.year}</td>
              <td>${formatCurrencyForPDF(payment.amount)}</td>
            </tr>
          </tbody>
        </table>

        <div class="totals-section">
          <div class="totals-box">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>${formatCurrencyForPDF(payment.amount)}</span>
            </div>
            <div class="total-row final">
              <span>Total Due:</span>
              <span>${formatCurrencyForPDF(payment.amount)}</span>
            </div>
            <div class="total-row" style="border-bottom: none; padding-bottom: 0;">
              <span>Amount Paid:</span>
              <span>${payment.status === 'paid' ? formatCurrencyForPDF(payment.amount) : '0.00'}</span>
            </div>
          </div>
        </div>

        ${payment.notes ? `
          <div style="margin: 30px 0; padding: 15px; background-color: #f1f5f9; border-radius: 6px;">
            <p style="font-size: 12px; color: #64748b; margin: 0 0 5px 0; font-weight: 600;">Additional Notes:</p>
            <p style="font-size: 13px; color: #475569; margin: 0;">${payment.notes}</p>
          </div>
        ` : ''}

        <div class="footer">
          <p>This is a computer-generated invoice. No signature is required.</p>
          <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return htmlContent;
};

export const downloadInvoicePDF = (data: InvoiceData) => {
  const htmlContent = generateInvoicePDF(data);
  const { payment } = data;

  // Create a blob from the HTML content
  const blob = new Blob([htmlContent], { type: "text/html" });
  const url = URL.createObjectURL(blob);

  // Create an iframe to print
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = url;
  document.body.appendChild(iframe);

  // Wait for iframe to load then print
  iframe.onload = () => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 100);
  };
};

const formatCurrencyForPDF = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};
