// Image Service - Handle image processing (blurring, resizing)
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

class ImageService {
    /**
     * Process profile photo - create clear and blurred versions
     * @param {string} filePath - Path to the original image
     * @returns {Promise<Object>} Paths to clear and blurred images
     */
    async processProfilePhoto(filePath) {
        try {
            const parsedPath = path.parse(filePath);
            const clearPath = filePath;
            const blurredPath = path.join(
                parsedPath.dir,
                `${parsedPath.name}_blurred${parsedPath.ext}`
            );

            // Create blurred version (gaussian blur with sigma 20)
            await sharp(filePath)
                .blur(20)
                .toFile(blurredPath);

            // Optionally resize/optimize the clear version
            await sharp(filePath)
                .resize(800, 800, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .jpeg({ quality: 85 })
                .toFile(filePath + '.tmp');

            // Replace original with optimized version
            await fs.rename(filePath + '.tmp', filePath);

            return {
                clearUrl: clearPath.replace(/\\/g, '/').replace('uploads/', '/uploads/'),
                blurredUrl: blurredPath.replace(/\\/g, '/').replace('uploads/', '/uploads/')
            };

        } catch (error) {
            console.error('Error processing profile photo:', error);
            throw new Error('Failed to process profile photo');
        }
    }

    /**
     * Process multiple profile photos
     * @param {Array<string>} filePaths - Array of file paths
     * @returns {Promise<Object>} Arrays of clear and blurred URLs
     */
    async processMultiplePhotos(filePaths) {
        try {
            const results = await Promise.all(
                filePaths.map(filePath => this.processProfilePhoto(filePath))
            );

            return {
                clearUrls: results.map(r => r.clearUrl),
                blurredUrls: results.map(r => r.blurredUrl)
            };

        } catch (error) {
            console.error('Error processing multiple photos:', error);
            throw error;
        }
    }

    /**
     * Create thumbnail from image
     * @param {string} filePath - Path to the original image
     * @param {number} size - Thumbnail size (default: 150px)
     * @returns {Promise<string>} Path to thumbnail
     */
    async createThumbnail(filePath, size = 150) {
        try {
            const parsedPath = path.parse(filePath);
            const thumbnailPath = path.join(
                parsedPath.dir,
                `${parsedPath.name}_thumb${parsedPath.ext}`
            );

            await sharp(filePath)
                .resize(size, size, {
                    fit: 'cover',
                    position: 'center'
                })
                .jpeg({ quality: 80 })
                .toFile(thumbnailPath);

            return thumbnailPath.replace(/\\/g, '/').replace('uploads/', '/uploads/');

        } catch (error) {
            console.error('Error creating thumbnail:', error);
            throw error;
        }
    }

    /**
     * Validate image file
     * @param {string} filePath - Path to image file
     * @returns {Promise<Object>} Image metadata
     */
    async validateImage(filePath) {
        try {
            const metadata = await sharp(filePath).metadata();

            // Check dimensions (minimum 200x200, maximum 5000x5000)
            if (metadata.width < 200 || metadata.height < 200) {
                throw new Error('Image is too small. Minimum size is 200x200 pixels.');
            }

            if (metadata.width > 5000 || metadata.height > 5000) {
                throw new Error('Image is too large. Maximum size is 5000x5000 pixels.');
            }

            return {
                valid: true,
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                size: metadata.size
            };

        } catch (error) {
            throw new Error(`Invalid image: ${error.message}`);
        }
    }

    /**
     * Delete image and its variations
     * @param {string} filePath - Path to the main image
     */
    async deleteImage(filePath) {
        try {
            const parsedPath = path.parse(filePath);
            const variations = [
                filePath, // Original
                path.join(parsedPath.dir, `${parsedPath.name}_blurred${parsedPath.ext}`),
                path.join(parsedPath.dir, `${parsedPath.name}_thumb${parsedPath.ext}`)
            ];

            await Promise.all(
                variations.map(async (file) => {
                    try {
                        await fs.unlink(file);
                    } catch (error) {
                        // File might not exist, ignore error
                        if (error.code !== 'ENOENT') {
                            console.error(`Error deleting ${file}:`, error);
                        }
                    }
                })
            );

        } catch (error) {
            console.error('Error deleting image:', error);
            throw error;
        }
    }

    /**
     * Apply different blur levels
     * @param {string} filePath - Path to image
     * @param {number} blurLevel - Blur intensity (1-50)
     * @returns {Promise<string>} Path to blurred image
     */
    async applyCustomBlur(filePath, blurLevel = 20) {
        try {
            const parsedPath = path.parse(filePath);
            const blurredPath = path.join(
                parsedPath.dir,
                `${parsedPath.name}_blur${blurLevel}${parsedPath.ext}`
            );

            await sharp(filePath)
                .blur(blurLevel)
                .toFile(blurredPath);

            return blurredPath.replace(/\\/g, '/').replace('uploads/', '/uploads/');

        } catch (error) {
            console.error('Error applying blur:', error);
            throw error;
        }
    }

    /**
     * Add watermark to image (optional for protection)
     * @param {string} filePath - Path to image
     * @param {string} watermarkText - Text to watermark
     * @returns {Promise<string>} Path to watermarked image
     */
    async addWatermark(filePath, watermarkText = '© Marriage Platform') {
        try {
            const parsedPath = path.parse(filePath);
            const watermarkedPath = path.join(
                parsedPath.dir,
                `${parsedPath.name}_watermarked${parsedPath.ext}`
            );

            // Create SVG watermark
            const svgText = `
                <svg width="200" height="30">
                    <text x="0" y="20" font-size="16" fill="white" opacity="0.5">
                        ${watermarkText}
                    </text>
                </svg>
            `;

            const watermarkBuffer = Buffer.from(svgText);

            await sharp(filePath)
                .composite([{
                    input: watermarkBuffer,
                    gravity: 'southeast'
                }])
                .toFile(watermarkedPath);

            return watermarkedPath.replace(/\\/g, '/').replace('uploads/', '/uploads/');

        } catch (error) {
            console.error('Error adding watermark:', error);
            throw error;
        }
    }
}

module.exports = new ImageService();
