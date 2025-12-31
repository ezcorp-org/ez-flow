import tailwind from 'bun-plugin-tailwind';
import index from './index.html';

const server = Bun.serve({
  port: 3001,
  routes: {
    '/': index,
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 Landing page running at http://localhost:${server.port}`);
