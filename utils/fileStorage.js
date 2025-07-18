// utils/fileStorage.js
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const mongoose = require('mongoose');

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

// Create MongoDB schema for file metadata
const fileSchema = new mongoose.Schema({
  filename: String,
  originalName: String,
  fileType: String,
  fileSize: Number,
  s3Key: String,
  s3Bucket: String,
  s3Location: String,
  uploadDate: { type: Date, default: Date.now }
});

const File = mongoose.model('File', fileSchema);

// Configure multer for S3 uploads
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.S3_BUCKET_NAME,
    acl: 'public-read',
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'certificates/' + uniqueSuffix + '-' + file.originalname);
    }
  })
});

module.exports = { upload, File };