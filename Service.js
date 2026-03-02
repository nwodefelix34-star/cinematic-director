import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

const AI_STUDIO_API_KEY = process.env.AI_STUDIO_API_KEY;
app.post("/api/ideas", async (req, res) => {
  const prompt = req.body.prompt;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${AI_STUDIO_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    const data = await response.json();

    res.json({
      ideas: data.candidates?.[0]?.content?.parts?.[0]?.text || "No ideas generated"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate ideas" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));