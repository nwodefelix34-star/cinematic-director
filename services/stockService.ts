export const searchStockImages = async (query: string) => {
  try {
    const res = await fetch(`/api/stock?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (data.images) {
      return data.images;
    }

    return [];
  } catch (error) {
    console.error("Stock image search failed:", error);
    return [];
  }
};
