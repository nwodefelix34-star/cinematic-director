export default async function handler(req, res) {
  const query = req.query.q;

  const pixabayKey = process.env.PIXABAY_API_KEY;
  const unsplashKey = process.env.UNSPLASH_API_KEY;

  try {
    const pixabay = await fetch(
      `https://pixabay.com/api/?key=${pixabayKey}&q=${encodeURIComponent(query)}&image_type=photo&per_page=10`
    );

    const pixabayData = await pixabay.json();

    if (pixabayData.hits && pixabayData.hits.length > 0) {
      return res.status(200).json({
        images: pixabayData.hits.map(img => img.largeImageURL)
      });
    }

    const unsplash = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&client_id=${unsplashKey}&per_page=10`
    );

    const unsplashData = await unsplash.json();

    return res.status(200).json({
      images: unsplashData.results.map(img => img.urls.small)
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Stock image search failed" });
  }
}
