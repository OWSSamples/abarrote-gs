// Archivo separado para evitar que jspdf/fflate rompa SSR en Next.js 16.2+
// jsPDF y jspdf-autotable se importan dinámicamente solo en cliente.

export async function generatePDF(
  title: string,
  data: Record<string, unknown>[],
  filename: string
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'landscape' });

  // 1. Cargar el Logo desde la red y convertirlo a PNG mediante canvas
  try {
    const img = new Image();
    img.src = '/logo_for_kiosko_login.svg';
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });

    if (img.width > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imgData = canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 14, 15, 30, (30 * img.height) / img.width);
      }
    }
  } catch (err) {
    console.error('Error cargando el logo en el PDF', err);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(33, 35, 38);
  doc.text(title, 50, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(109, 113, 117);
  doc.text(`Generado el: ${new Date().toLocaleString()}`, 283, 22, { align: 'right' });

  doc.setDrawColor(228, 229, 231);
  doc.setLineWidth(0.5);
  doc.line(14, 30, 283, 30);

  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    const tableHeaders = headers.map(h =>
      (h.charAt(0).toUpperCase() + h.slice(1).replace(/([A-Z])/g, ' $1')).toUpperCase()
    );

    const body = data.map((item) =>
      headers.map((h) => {
        const val = item[h];
        if (typeof val === 'object' && val !== null) return JSON.stringify(val);
        return String(val ?? '');
      })
    );

    autoTable(doc, {
      startY: 35,
      head: [tableHeaders],
      body: body,
      theme: 'plain',
      styles: {
        fontSize: 8,
        cellPadding: 1.5,
        font: 'helvetica',
        textColor: [33, 35, 38],
        lineColor: [228, 229, 231],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [244, 246, 248],
        textColor: [0, 68, 148],
        fontStyle: 'bold',
        lineColor: [228, 229, 231],
        lineWidth: { bottom: 0.5 }
      },
      alternateRowStyles: {
        fillColor: [252, 252, 252],
      },
      margin: { top: 40, left: 14, right: 14, bottom: 20 },
    });
  }

  doc.save(filename);
}
