const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');
const Certificate = require('../models/Certificate');
const emailService = require('../utils/emailService');
const qrGenerator = require('../utils/qrGenerator');
const { embedQRCodeInPDF } = require('../utils/pdfModifier');
const { rgb } = require('pdf-lib');
const fs = require('fs');

const router = express.Router();

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  signatureVersion: 'v4'
});

const s3 = new AWS.S3();

// Function to download Montserrat font using native fetch
async function loadMontserratFont() {
  try {
    const fontUrl = 'https://github.com/JulietaUla/Montserrat/blob/master/fonts/ttf/Montserrat-Regular.ttf?raw=true';
    const response = await fetch(fontUrl);
    
    if (!response.ok) {
      throw new Error(`Font download failed with status ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const fontBuffer = Buffer.from(arrayBuffer);
    
    if (fontBuffer.length < 1000) {
      throw new Error('Downloaded font file appears too small');
    }
    
    return fontBuffer;
  } catch (err) {
    console.error('Montserrat font loading error:', err);
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Montserrat font required in production');
    }
    return null;
  }
}

// Middleware
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

// File upload configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    const fileExt = path.extname(file.originalname).toLowerCase().substring(1);
    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png'];
    
    if (allowedTypes.includes(file.mimetype) && allowedExtensions.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Only ${allowedExtensions.join(', ')} files are allowed.`));
    }
  }
}).single('certificate');

// S3 Upload Helper
const uploadToS3 = async (file) => {
  const fileExt = path.extname(file.originalname).toLowerCase().substring(1);
  const key = `certificates/${uuidv4()}.${fileExt}`;
  
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: 'public-read',
    Metadata: {
      originalName: encodeURIComponent(file.originalname)
    }
  };

  try {
    const data = await s3.upload(params).promise();
    return {
      s3Key: data.Key,
      s3Bucket: data.Bucket,
      s3Location: data.Location
    };
  } catch (err) {
    console.error('S3 upload error:', err);
    throw new Error('Failed to upload file to storage');
  }
};

const getPublicUrl = (key) => {
  return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
};

// Main Upload Endpoint
router.post('/upload', (req, res) => {
  upload(req, res, async (err) => {
    try {
      // Error handling
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            message: `File too large. Maximum size is ${formatFileSize(parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024)}`
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      const file = req.file;
      const email = req.body.email;
      const certificateId = uuidv4();
      const viewUrl = `${process.env.FRONTEND_URL}/view/${certificateId}`;

      // Step 1: Generate QR Code
      let qrCodeBuffer;
      try {
        qrCodeBuffer = await qrGenerator.generateQRBuffer(viewUrl);
        if (process.env.NODE_ENV === 'development') {
          fs.writeFileSync('debug-qr.png', qrCodeBuffer);
        }
      } catch (qrError) {
        console.error('QR generation failed:', qrError);
        throw new Error('Failed to generate QR code');
      }

      // Step 2: Process PDF (if applicable)
      let finalFileBuffer = file.buffer;
      let hasEmbeddedQR = false;

      if (file.mimetype === 'application/pdf') {
        try {
          if (process.env.NODE_ENV === 'development') {
            fs.writeFileSync('debug-original.pdf', file.buffer);
          }
          
          const montserratFontBuffer = await loadMontserratFont();
    
    if (!montserratFontBuffer) {
      console.warn('Proceeding with fallback font (Helvetica)');
    }

    finalFileBuffer = await embedQRCodeInPDF(
  file.buffer,
  qrCodeBuffer,
  {
    size: 100,
    margin: 50,
    text: 'Scan to verify',
    textOptions: {
      size: 10,
      color: rgb(0.651, 0.651, 0.651), // #a6a6a6
      fontBuffer: montserratFontBuffer
    },
    viewUrl: viewUrl
  }
);
          
          if (process.env.NODE_ENV === 'development') {
            fs.writeFileSync('debug-modified.pdf', finalFileBuffer);
          }
          hasEmbeddedQR = true;
        } catch (embedError) {
          console.error('Failed to embed QR code:', embedError);
        }
      }

      // Step 3: Upload to S3
      const s3Data = await uploadToS3({
        ...file,
        buffer: finalFileBuffer
      });
      const publicUrl = getPublicUrl(s3Data.s3Key);

      // Step 4: Save to Database
      const certificate = new Certificate({
        _id: certificateId,
        fileName: file.originalname,
        originalName: file.originalname,
        fileType: path.extname(file.originalname).substring(1).toLowerCase(),
        fileSize: finalFileBuffer.length,
        s3Key: s3Data.s3Key,
        s3Bucket: s3Data.s3Bucket,
        s3Location: publicUrl,
        filePath: publicUrl,
        uploadDate: new Date(),
        hasEmbeddedQR,
        qrCode: `data:image/png;base64,${qrCodeBuffer.toString('base64')}`
      });
      await certificate.save();

      // Step 5: Send Email (if provided)
      if (email) {
        try {
          await emailService.sendCertificateLink(
            email, 
            certificateId, 
            file.originalname,
            viewUrl
          );
        } catch (emailError) {
          console.error('Email sending failed:', emailError);
        }
      }

      // Final Response
      res.status(201).json({
        success: true,
        message: 'Certificate uploaded successfully',
        data: {
          id: certificateId,
          fileName: file.originalname,
          fileSize: finalFileBuffer.length,
          fileType: path.extname(file.originalname).substring(1).toLowerCase(),
          uploadDate: new Date(),
          viewUrl: viewUrl,
          qrCode: certificate.qrCode,
          downloadUrl: publicUrl,
          hasEmbeddedQR
        }
      });

    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to process certificate upload',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });
});

// Enhanced PDF Viewer Endpoint
router.get('/view/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const certificate = await Certificate.findById(id);
    
    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    // For PDF files, stream directly from S3
    if (certificate.fileType === 'pdf') {
      const s3Response = await s3.getObject({
        Bucket: certificate.s3Bucket,
        Key: certificate.s3Key
      }).promise();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${certificate.fileName}"`);
      return res.send(s3Response.Body);
    }

    // For images, redirect to public URL
    res.redirect(certificate.s3Location);

  } catch (error) {
    console.error('View error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve certificate'
    });
  }
});

// Get certificate file - redirect to public URL
router.get('/certificate/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const certificate = await Certificate.findById(id);

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    // Redirect to the public URL
    res.redirect(certificate.s3Location);

  } catch (error) {
    console.error('Certificate retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve certificate'
    });
  }
});

// GET /certificate/:id/info - Get certificate metadata
router.get('/certificate/:id/info', async (req, res) => {
  try {
    const { id } = req.params;
    const certificate = await Certificate.findById(id);

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: certificate._id,
        fileName: certificate.originalName,
        fileType: certificate.fileType,
        fileSize: certificate.fileSize,
        uploadDate: certificate.uploadDate,
        s3Location: certificate.s3Location
      }
    });

  } catch (error) {
    console.error('Certificate info retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve certificate information'
    });
  }
});

// GET /certificate/:id/qr - Generate QR code
router.get('/certificate/:id/qr', async (req, res) => {
  try {
    const { id } = req.params;
    const certificate = await Certificate.findById(id);

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    const viewUrl = `${process.env.FRONTEND_URL}/view/${id}`;
    const qrCodeBuffer = await qrGenerator.generateQRBuffer(viewUrl);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="certificate-${id}-qr.png"`);
    res.send(qrCodeBuffer);

  } catch (error) {
    console.error('QR code generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate QR code'
    });
  }
});

// POST /send-intern-certificate - Send intern certificate email
router.post('/send-intern-certificate', async (req, res) => {
  try {
    const { name, email, startDate, endDate, role, certificateId } = req.body;

    // Validate required fields
    if (!name || !email || !startDate || !endDate || !role || !certificateId) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Send email
    await emailService.sendCertificateLink(
      email,
      certificateId,
      `${name}'s Internship Certificate.pdf`,
      name,
      role,
      new Date(startDate).toLocaleDateString(),
      new Date(endDate).toLocaleDateString()
    );

    res.json({
      success: true,
      message: 'Certificate email sent successfully'
    });

  } catch (error) {
    console.error('Error sending intern certificate:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send certificate email'
    });
  }
});

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]);
}

module.exports = router;