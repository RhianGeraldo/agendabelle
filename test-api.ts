import { buscarDisponibilidade } from './src/lib/api';

async function test() {
  try {
    const res = await buscarDisponibilidade('aracruz', 1, '18/07/2026', 'tarde');
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error(err);
  }
}
test();
