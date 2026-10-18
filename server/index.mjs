import { createApp } from './app.mjs';

const { app, finish, close } = createApp();
finish();
const server = app.listen(Number(process.env.PORT || 3001), process.env.HOST || '127.0.0.1', () => {
  console.log('Saathi Care API ready at http://localhost:' + (process.env.PORT || 3001));
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { close(); process.exit(0); }));
