// Upload Middleware - Handle file uploads with Multer
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const uploadDir = process.env.UPLOAD_DIR || './uploads';
const selfiesDir = path.join(uploadDir, 'selfies');
const idDocsDir = path.join(uploadDir, 'id-documents');
const profilePhotosDir = path.join(uploadDir, 'profile-photos');

[uploadDir, selfiesDir, idDocsDir, profilePhotosDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Storage configuration for selfie verification
const selfieStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, selfiesDir);
    },
    filename: (req, file, cb) => {
        const userId = req.user.id;
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `selfie_${userId}_${timestamp}${ext}`);
    }
});

// Storage configuration for ID documents
const idDocStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, idDocsDir);
    },
    filename: (req, file, cb) => {
        const userId = req.user.id;
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `id_${userId}_${timestamp}${ext}`);
    }
});

// Storage configuration for profile photos
const profilePhotoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, profilePhotosDir);
    },
    filename: (req, file, cb) => {
        const userId = req.user.id;
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `profile_${userId}_${timestamp}${ext}`);
    }
});

// File filter - only images
const imageFileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
    }
};

// Max file size (5MB)
const maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024; // 5MB

// Multer configurations
const uploadSelfie = multer({
    storage: selfieStorage,
    fileFilter: imageFileFilter,
    limits: {
        fileSize: maxFileSize
    }
}).single('selfie');

const uploadIdDocument = multer({
    storage: idDocStorage,
    fileFilter: imageFileFilter,
    limits: {
        fileSize: maxFileSize
    }
}).single('id_document');

const uploadProfilePhoto = multer({
    storage: profilePhotoStorage,
    fileFilter: imageFileFilter,
    limits: {
        fileSize: maxFileSize
    }
}).single('photo');

const uploadMultipleProfilePhotos = multer({
    storage: profilePhotoStorage,
    fileFilter: imageFileFilter,
    limits: {
        fileSize: maxFileSize,
        files: 5 // Max 5 photos
    }
}).array('photos', 5);

// Error handler middleware
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File is too large. Maximum size is 5MB.'
            });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                error: 'Too many files. Maximum is 5 photos.'
            });
        }
        return res.status(400).json({
            success: false,
            error: `Upload error: ${err.message}`
        });
    }

    if (err) {
        return res.status(400).json({
            success: false,
            error: err.message
        });
    }

    next();
};

module.exports = {
    uploadSelfie,
    uploadIdDocument,
    uploadProfilePhoto,
    uploadMultipleProfilePhotos,
    handleUploadError,
    uploadDir,
    selfiesDir,
    idDocsDir,
    profilePhotosDir
};
