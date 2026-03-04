export default async function handler(req, res) {
  const query = req.query.q;

  const pexelsKey = process.env.PEXELS_API_KEY;

  const r = await fetch(
    `https://api.pexels.com/v1/search?query=${query}&per_page=10`,
    {
      headers: {
        Authorization: pexelsKey,
      },
    }
  );

  const data = await r.json();

  res.status(200).json(data);
}
