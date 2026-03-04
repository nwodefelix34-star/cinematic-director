export const searchStockImages = async (query: string) => {
  try {
    const res = await fetch(`/api/stock?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (data.photos) {
      return data.photos.map((img: any) => img.src.medium);
    }

    if (data.results) {
      return data.results.map((img: any) => img.urls.small);
    }

    return [];
  } catch (error) {
    console.error("Stock image search failed:", error);
    return [];
  }
};
