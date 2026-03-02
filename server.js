import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'dist')));



// ======================
// HEALTH CHECK
// ======================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});



// ======================
// CREATE IDEA
// ======================
app.post('/api/create-idea', (req, res) => {
  const { title } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const insertIdea = db.prepare(`
    INSERT INTO ideas (title) VALUES (?)
  `);

  const result = insertIdea.run(title);

  db.prepare(`
    INSERT INTO project_states (idea_id, state_json)
    VALUES (?, ?)
  `).run(result.lastInsertRowid, JSON.stringify({}));

  res.json({ ideaId: result.lastInsertRowid });
});



// ======================
// SAVE STATE
// ======================
app.post('/api/save-state', (req, res) => {
  const { ideaId, state } = req.body;

  if (!ideaId || !state) {
    return res.status(400).json({ error: 'Missing ideaId or state' });
  }

  db.prepare(`
    UPDATE project_states
    SET state_json = ?, last_saved_at = CURRENT_TIMESTAMP
    WHERE idea_id = ?
  `).run(JSON.stringify(state), ideaId);

  db.prepare(`
    UPDATE ideas
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(ideaId);

  res.json({ success: true });
});



// ======================
// LOAD STATE
// ======================
app.get('/api/load-state/:id', (req, res) => {
  const ideaId = req.params.id;

  const row = db.prepare(`
    SELECT state_json FROM project_states
    WHERE idea_id = ?
  `).get(ideaId);

  if (!row) {
    return res.status(404).json({ error: 'Idea not found' });
  }

  res.json({ state: JSON.parse(row.state_json || '{}') });
});



// ======================
// STOCK SEARCH
// ======================
app.get('/api/stock-search', async (req, res) => {
  try {
    const query = req.query.q;

    if (!query) {
      return res.status(400).json({ error: 'Missing search query' });
    }

    const encodedQuery = encodeURIComponent(query);

    // Search Unsplash
    const unsplashRes = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodedQuery}&orientation=portrait&per_page=5`,
      {
        headers: {
          Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`
        }
      }
    );

    const unsplashData = await unsplashRes.json();
    const unsplashResults = unsplashData.results || [];

    // Search Pixabay
    const pixabayRes = await fetch(
      `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodedQuery}&image_type=photo&orientation=vertical&per_page=5`
    );

    const pixabayData = await pixabayRes.json();
    const pixabayResults = pixabayData.hits || [];

    const combined = [];

    unsplashResults.forEach(img => {
      combined.push({
        url: img.urls.regular,
        width: img.width,
        height: img.height
      });
    });

    pixabayResults.forEach(img => {
      combined.push({
        url: img.largeImageURL,
        width: img.imageWidth,
        height: img.imageHeight
      });
    });

    if (combined.length === 0) {
      return res.status(404).json({ error: 'No images found' });
    }

    combined.sort((a, b) => (b.width * b.height) - (a.width * a.height));

    res.json({ imageUrl: combined[0].url });

  } catch (error) {
    console.error('Stock search error:', error);
    res.status(500).json({ error: 'Stock search failed' });
  }
});

app.get('/api/test-create', (req, res) => {
  const result = db.prepare(`
    INSERT INTO ideas (title) VALUES (?)
  `).run("Test Idea");

  res.json({ insertedId: result.lastInsertRowid });
});

// ======================
// CATCH ALL (KEEP LAST)
// ======================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});



// ======================
// START SERVER
// ======================
app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});