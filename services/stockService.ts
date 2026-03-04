export const searchStockImages = async (query: string) => {
  try {

    const pixabayKey = import.meta.env.VITE_PIXABAY_API_KEY;
    const unsplashKey = import.meta.env.VITE_UNSPLASH_API_KEY;

    const pixabay = await fetch(
      `https://pixabay.com/api/?key=${pixabayKey}&q=${encodeURIComponent(query)}&image_type=photo&per_page=10`
    );

    const pixabayData = await pixabay.json();

    if (pixabayData.hits && pixabayData.hits.length > 0) {
      return pixabayData.hits.map((img: any) => img.webformatURL);
    }

    const unsplash = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&client_id=${unsplashKey}&per_page=10`
    );

    const unsplashData = await unsplash.json();

    return unsplashData.results.map((img: any) => img.urls.small);

  } catch (error) {
    console.error("Stock image search failed:", error);
    return [];
  }
};
