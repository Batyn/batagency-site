// Типограф для каждой страницы: при сборке — один раз на страницу, в dev — на каждый запрос.
import { defineMiddleware } from 'astro:middleware';
import { typoHtml } from './lib/typograf';

export const onRequest = defineMiddleware(async (_, next) => {
  const res = await next();
  if (!res.headers.get('content-type')?.includes('text/html')) return res;
  const html = typoHtml(await res.text());
  return new Response(html, { status: res.status, statusText: res.statusText, headers: res.headers });
});
