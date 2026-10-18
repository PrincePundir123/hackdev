import { createApp } from './app.mjs';

const { app, care, finish, close } = createApp();
finish();
const worker = setInterval(() => {
  try { care.tick(); care.deliver().catch(error => console.error('Delivery worker failed:', error.message)); }
  catch (error) { console.error('Care worker failed:', error.message); }
}, 1000);
const server = app.listen(Number(process.env.PORT || 3001), process.env.HOST || '127.0.0.1', () => {
  console.log('Saathi Care API ready at http://localhost:' + (process.env.PORT || 3001));
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { clearInterval(worker); server.close(() => { close(); process.exit(0); }); });
