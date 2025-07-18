const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');

async function embedQRCodeInPDF(pdfBytes, qrBuffer, options = {}) {
  try {
    const {
      size = 120,
      margin = 20,
      text = 'Scan to verify',
      textOptions = {
        size: 10,
        color: rgb(0.651, 0.651, 0.651), // #a6a6a6
        fontBuffer: null
      }
    } = options;

    const pdfDoc = await PDFDocument.load(pdfBytes);
    pdfDoc.registerFontkit(fontkit);
    
    // Embed Montserrat if available, otherwise fallback to Helvetica
    let textFont;
    if (textOptions.fontBuffer) {
      try {
        textFont = await pdfDoc.embedFont(textOptions.fontBuffer);
      } catch (fontError) {
        console.error('Failed to embed Montserrat, using Helvetica fallback:', fontError);
        textFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      }
    } else {
      textFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    const qrImage = await pdfDoc.embedPng(qrBuffer);
    const pages = pdfDoc.getPages();

    for (const page of pages) {
      const { width, height } = page.getSize();
      
      // Fixed QR position
      const qrX = 585;
      const qrY = 220;
      
      // Draw QR code
      page.drawImage(qrImage, { 
        x: qrX, 
        y: qrY, 
        width: size, 
        height: size 
      });

      // Draw description text
      const textX = qrX + (size / 2) - (text.length * textOptions.size / 4);
      const textY = qrY - margin + 40;

      page.drawText(text, {
        x: textX,
        y: textY,
        size: textOptions.size,
        color: textOptions.color,
        font: textFont
      });

      // Draw URL
      const url = options.viewUrl;
      const urlY = margin;
      
      page.drawText(url, {
        x: margin,
        y: urlY - 30,
        size: textOptions.size,
        color: textOptions.color,
        font: textFont
      });
    }

    return await pdfDoc.save();
  } catch (error) {
    console.error('PDF Modification Error:', error);
    throw new Error('Failed to embed QR code in PDF');
  }
}

module.exports = { embedQRCodeInPDF };