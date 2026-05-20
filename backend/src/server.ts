import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import generateStoryRouter from './routes/generate-story';
import regenerateImagesRouter from './routes/regenerate-images';
import generateScriptRouter from './routes/generate-script';
import generateImagesFromScriptRouter from './routes/generate-images-from-script';
import generateVideosFromScenesRouter from './routes/generate-videos-from-scenes';

const app = express();

app.use(
  cors({
    origin: 'http://localhost:3000',
  })
);

app.use(express.json({ limit: '50mb' }));

// Sirve los assets persistidos (videos descargados, futuros renders, etc.)
// Path absoluto desde la raíz del repo: <root>/assets/...
const ASSETS_DIR = path.resolve(__dirname, '..', '..', 'assets');
app.use('/assets', express.static(ASSETS_DIR));

app.use((req, _res, next) => {
  console.log(`[backend] ${req.method} ${req.url}`);
  next();
});

app.use('/api', generateStoryRouter);
app.use('/api', regenerateImagesRouter);
app.use('/api', generateScriptRouter);
app.use('/api', generateImagesFromScriptRouter);
app.use('/api', generateVideosFromScenesRouter);

app.use((req, res) => {
  console.warn(`[backend] 404 no route for ${req.method} ${req.url}`);
  res.status(404).json({ success: false, error: `No route for ${req.method} ${req.url}` });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[backend] unhandled error:', err);
  res.status(500).json({ success: false, error: err.message });
});

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, () => {
  console.log(`[backend] Tim Koda gateway listening on http://localhost:${PORT}`);
});
