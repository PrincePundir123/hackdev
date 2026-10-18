import express from 'express';

const app = express();
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.listen(Number(process.env.PORT || 3001), process.env.HOST || '127.0.0.1', () => {
  console.log('Saathi Care API ready at http://localhost:' + (process.env.PORT || 3001));
});
