/**
 * Determine media type from URL based on file extension
 * @param {string} url - Media URL
 * @returns {string} Media type: 'image', 'video', 'audio', or 'document'
 */
function getMediaType(url) {
  const ext = url.toLowerCase().split('.').pop().split('?')[0];

  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return 'image';
  } else if (['mp4', 'mov', 'avi'].includes(ext)) {
    return 'video';
  } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
    return 'audio';
  } else if (['pdf', 'doc', 'docx'].includes(ext)) {
    return 'document';
  }

  return 'document';
}

/**
 * Download media from URL with retry logic
 * @param {string} url - Media URL
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<Buffer>} Media buffer
 */
async function downloadMedia(url, maxRetries = 3) {
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      console.log(`📥 Downloading media (attempt ${retryCount + 1}/${maxRetries}): ${url}`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();

      if (buffer.byteLength === 0) {
        throw new Error('Downloaded file is empty (0 bytes)');
      }

      console.log(`✅ Media downloaded: ${buffer.byteLength} bytes`);
      return Buffer.from(buffer);

    } catch (error) {
      retryCount++;
      console.error(`❌ Error downloading media (attempt ${retryCount}/${maxRetries}):`, error.message);

      if (retryCount >= maxRetries) {
        throw error;
      }

      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
    }
  }
}

/**
 * Prepare message content based on media type
 * @param {Buffer} mediaBuffer - Media buffer
 * @param {string} mediaType - Media type
 * @param {string} caption - Message caption
 * @returns {Object} Message content object
 */
function prepareMediaMessage(mediaBuffer, mediaType, caption = '') {
  switch (mediaType) {
    case 'image':
      return {
        image: mediaBuffer,
        caption
      };
    case 'video':
      return {
        video: mediaBuffer,
        caption
      };
    case 'audio':
      return {
        audio: mediaBuffer,
        mimetype: 'audio/mp4'
      };
    case 'document':
      return {
        document: mediaBuffer,
        caption,
        mimetype: 'application/pdf'
      };
    default:
      return { text: caption };
  }
}

module.exports = {
  getMediaType,
  downloadMedia,
  prepareMediaMessage
};
