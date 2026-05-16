import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import generateStoryRouter from './routes/generate-story';
import regenerateImagesRouter from './routes/regenerate-images';
import generateScriptRouter from './routes/generate-script';
import generateImagesFromScriptRouter from './routes/generate-images-from-script';

const app = express();

app.use(
  cors({
    origin: 'http://localhost:3000',
  })
);

app.use(express.json({ limit: '50mb' }));

app.use('/api', generateStoryRouter);
app.use('/api', regenerateImagesRouter);
app.use('/api', generateScriptRouter);
app.use('/api', generateImagesFromScriptRouter);

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, () => {
  console.log(`[backend] Tim Koda gateway listening on http://localhost:${PORT}`);
});
