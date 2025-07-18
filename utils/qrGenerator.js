// utils/qrGenerator.js
const QRCode = require('qrcode');

class QRGenerator {
  async generateQR(url, config = {}) {
    try {
      const defaultConfig = {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        quality: 1.0,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF00'
        },
        width: 300
      };
      
      const qrCodeDataURL = await QRCode.toDataURL(url, { ...defaultConfig, ...config });
      return qrCodeDataURL;
    } catch (error) {
      console.error('QR Code generation failed:', error);
      throw new Error('Failed to generate QR code image');
    }
  }

  async generateQRBuffer(url, config = {}) {
    try {
      const defaultConfig = {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        quality: 1.0,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF00'
        },
        width: 300
      };
      
      const qrCodeBuffer = await QRCode.toBuffer(url, { ...defaultConfig, ...config });
      return qrCodeBuffer;
    } catch (error) {
      console.error('QR Code buffer generation failed:', error);
      throw new Error('Failed to generate QR code buffer');
    }
  }
}

module.exports = new QRGenerator();