export default async function handler(req, res) {
  const query = req.query.q;

  const pixabayKey = process.env.PIXABAY_API_KEY;
  const unsplashKey = process.env.UNSPLASH_API_KEY;

  try {

    const pixabayPromise = fetch(
      `https://pixabay.com/api/?key=${pixabayKey}&q=${encodeURIComponent(query)}&image_type=photo&per_page=10`
    );

    const unsplashPromise = fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&client_id=${unsplashKey}&per_page=10`
    );

    const [pixabayRes, unsplashRes] = await Promise.all([
      pixabayPromise,
      unsplashPromise
    ]);

    const pixabayData = await pixabayRes.json();
    const unsplashData = await unsplashRes.json();

    const pixabayImages =
      pixabayData?.hits?.map(img => img.largeImageURL) || [];

    const unsplashImages =
      unsplashData?.results?.map(img => img.urls.regular) || [];

    const images = [...pixabayImages, ...unsplashImages];

    return res.status(200).json({ images });

  } catch (error) {
    console.error("Stock API error:", error);

    return res.status(500).json({
      error: "Stock image search failed",
      images: []
    });
  }
}
