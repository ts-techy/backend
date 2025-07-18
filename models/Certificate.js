const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Custom _id (string, likely UUID from upload.js)
  fileName: { type: String, required: true },
  originalName: { type: String, required: true },
  filePath: {
    type: String,
    required: false // Make it optional
  },
  s3Key: { type: String, required: true },
  s3Bucket: { type: String, required: true },
  s3Location: { type: String, required: true },
  fileType: { type: String, required: true },
  fileSize: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  uploadDate: { type: Date, default: Date.now }
}, {
  timestamps: true,
});

module.exports = mongoose.model('Certificate', certificateSchema);