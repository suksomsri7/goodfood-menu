// Bunny.net Storage Configuration
const BUNNY_STORAGE_ZONE = "goodfood";
const BUNNY_STORAGE_HOST = "sg.storage.bunnycdn.com";
const BUNNY_API_KEY = "a0344029-c16a-441b-a0c5fa420b67-fb4d-4cfb";
const BUNNY_CDN_URL = "https://goodfood.b-cdn.net"; // CDN URL สำหรับ serve รูป

/**
 * Generate unique filename
 */
function generateFileName(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = originalName.split(".").pop() || "jpg";
  return `${timestamp}-${random}.${ext}`;
}

/**
 * Extract filename from Bunny CDN URL
 */
export function extractFileNameFromUrl(url: string): string | null {
  if (!url || !url.includes(BUNNY_CDN_URL)) return null;
  const parts = url.split("/");
  return parts[parts.length - 1];
}

/**
 * Upload image to Bunny.net Storage
 * @param base64Image - Base64 encoded image data (with or without data URL prefix)
 * @param folder - Folder path (e.g., "foods", "packages", "promotions")
 * @param originalFileName - Original file name for extension
 * @returns CDN URL of uploaded image
 */
export async function uploadToBunny(
  base64Image: string,
  folder: string = "foods",
  originalFileName: string = "image.jpg"
): Promise<string> {
  try {
    // Remove data URL prefix if present
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    
    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, "base64");
    
    // Generate unique filename
    const fileName = generateFileName(originalFileName);
    const filePath = `${folder}/${fileName}`;
    
    // Upload to Bunny Storage via HTTP API
    const uploadUrl = `https://${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE}/${filePath}`;
    
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "AccessKey": BUNNY_API_KEY,
        "Content-Type": "application/octet-stream",
      },
      body: buffer,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bunny upload failed: ${response.status} - ${errorText}`);
    }
    
    // Return CDN URL
    return `${BUNNY_CDN_URL}/${filePath}`;
  } catch (error) {
    console.error("Error uploading to Bunny:", error);
    throw error;
  }
}

/**
 * Delete image from Bunny.net Storage
 * @param imageUrl - Full CDN URL of the image
 */
export async function deleteFromBunny(imageUrl: string): Promise<boolean> {
  try {
    if (!imageUrl || !imageUrl.includes(BUNNY_CDN_URL)) {
      console.log("Not a Bunny CDN URL, skipping delete:", imageUrl);
      return false;
    }
    
    // Extract file path from URL
    const filePath = imageUrl.replace(`${BUNNY_CDN_URL}/`, "");
    
    // Delete from Bunny Storage via HTTP API
    const deleteUrl = `https://${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE}/${filePath}`;
    
    const response = await fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        "AccessKey": BUNNY_API_KEY,
      },
    });
    
    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      console.error(`Bunny delete failed: ${response.status} - ${errorText}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error deleting from Bunny:", error);
    return false;
  }
}

/**
 * Upload multiple images to Bunny.net
 * @param base64Images - Array of base64 encoded images
 * @param folder - Folder path
 * @returns Array of CDN URLs
 */
export async function uploadMultipleToBunny(
  base64Images: string[],
  folder: string = "foods"
): Promise<string[]> {
  const uploadPromises = base64Images.map((img, index) =>
    uploadToBunny(img, folder, `image-${index}.jpg`)
  );
  return Promise.all(uploadPromises);
}

/**
 * Delete multiple images from Bunny.net
 * @param imageUrls - Array of CDN URLs
 */
export async function deleteMultipleFromBunny(imageUrls: string[]): Promise<void> {
  const deletePromises = imageUrls.map((url) => deleteFromBunny(url));
  await Promise.all(deletePromises);
}

/**
 * Check if string is a base64 image
 */
export function isBase64Image(str: string): boolean {
  return str.startsWith("data:image/") || /^[A-Za-z0-9+/=]+$/.test(str);
}

/**
 * Check if string is a Bunny CDN URL
 */
export function isBunnyCdnUrl(str: string): boolean {
  return str.startsWith(BUNNY_CDN_URL) || str.startsWith("https://") || str.startsWith("http://");
}
