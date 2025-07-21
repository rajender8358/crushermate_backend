const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { asyncHandler } = require('./errorHandler');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'demo',
  api_key: process.env.CLOUDINARY_API_KEY || 'demo',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'demo',
});

// Configure storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'crushermate/truck-images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
    transformation: [
      { width: 800, height: 600, crop: 'limit' },
      { quality: 'auto' },
    ],
  },
});

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// Middleware for single image upload
const uploadTruckImage = upload.single('truckImage');

// Wrapper to handle multer errors
const handleImageUpload = (req, res, next) => {
  const contentType = req.headers['content-type'] || '';

  // If it's JSON data, skip multer processing
  if (contentType.includes('application/json')) {
    console.log('📁 Upload middleware - JSON request, skipping multer');
    return next();
  }

  // For multipart form data, use multer
  uploadTruckImage(req, res, err => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Image file size too large. Maximum size is 5MB.',
          error: 'FILE_SIZE_ERROR',
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Image upload error',
        error: 'UPLOAD_ERROR',
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
        error: 'FILE_TYPE_ERROR',
      });
    }

    // Log the parsed data for debugging
    console.log('📁 Upload middleware - Parsed data:', {
      body: req.body,
      file: req.file,
      hasFile: !!req.file,
    });

    next();
  });
};

// Helper function to delete image from Cloudinary
const deleteImage = async publicId => {
  try {
    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
      console.log('✅ Image deleted from Cloudinary:', publicId);
    }
  } catch (error) {
    console.error('❌ Error deleting image from Cloudinary:', error);
  }
};

// Helper function to extract public ID from URL
const extractPublicId = url => {
  if (!url) return null;
  const parts = url.split('/');
  const filename = parts[parts.length - 1];
  return filename.split('.')[0]; // Remove file extension
};

module.exports = {
  handleImageUpload,
  deleteImage,
  extractPublicId,
};
