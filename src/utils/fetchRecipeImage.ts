// Cache for recipe images to avoid repeated API calls
const imageCache = new Map<string, string>();

export async function fetchRecipeImage(recipeName: string): Promise<string | undefined> {
  // Check cache first
  const cacheKey = recipeName.toLowerCase();
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey);
  }

  const apiKey = import.meta.env.VITE_PEXELS_API_KEY;

  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    console.warn('Pexels API key not configured');
    return undefined;
  }

  try {
    // Clean up recipe name for better search results
    // Remove special characters and extra words
    const searchQuery = recipeName
      .toLowerCase()
      .replace(/[^\w\s]/g, '')  // Remove special characters
      .replace(/\b(with|and|or|the|a|an)\b/g, '')  // Remove common words
      .trim()
      + ' food';  // Add 'food' to get better food images

    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=5&orientation=landscape`,
      {
        headers: {
          Authorization: apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.photos && data.photos.length > 0) {
      // Get the medium-sized image (landscape format)
      const imageUrl = data.photos[0].src.medium;

      // Cache the result
      imageCache.set(cacheKey, imageUrl);

      return imageUrl;
    }

    return undefined;
  } catch (error) {
    console.error(`Error fetching image for "${recipeName}":`, error);
    return undefined;
  }
}

// Fetch images for multiple recipes in parallel
export async function fetchRecipeImages(recipeNames: string[]): Promise<Map<string, string | undefined>> {
  const results = new Map<string, string | undefined>();

  // Fetch all images in parallel
  const promises = recipeNames.map(async (name) => {
    const image = await fetchRecipeImage(name);
    results.set(name, image);
  });

  await Promise.all(promises);

  return results;
}
