import vinext from 'vinext';
import {defineConfig} from 'vite';
import {sites} from './build/sites-vite-plugin';
// Node runtime with PostgreSQL in both development and production.
export default defineConfig({
 server:{host:'127.0.0.1'},
 plugins:[vinext(),sites({mockAuth:true})],
 ssr:{external:['pg']},
});
