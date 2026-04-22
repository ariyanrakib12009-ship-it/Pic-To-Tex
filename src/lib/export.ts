import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun } from 'docx';

// We'll need file-saver for blobs usually, but browser can also use anchor tag
// I'll install file-saver if needed, but for now I'll use native download

export const exportToPDF = (text: string, fontFamily: string) => {
  const doc = new jsPDF();
  // Attempt to set font. Note: jsPDF needs pre-registered fonts for complex scripts like Bengali.
  // We'll set the font name as a best-effort.
  try {
    doc.setFont(fontFamily);
  } catch (e) {
    doc.setFont('helvetica');
  }
  
  const splitText = doc.splitTextToSize(text, 180);
  doc.text(splitText, 10, 10);
  doc.save('ocr-export.pdf');
};

export const exportToDocx = async (text: string, fontFamily: string) => {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: text,
              font: fontFamily,
              size: 24, // 12pt
            }),
          ],
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ocr-export.docx';
  a.click();
  URL.revokeObjectURL(url);
};

export const exportToTxt = (text: string) => {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ocr-export.txt';
  a.click();
  URL.revokeObjectURL(url);
};
