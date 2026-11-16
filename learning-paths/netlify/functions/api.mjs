// Every /api/* request of the site.
import { handle } from '../../netlify-app.js';

export default (request, context) => handle(request, context);

export const config = { path: '/api/*' };
