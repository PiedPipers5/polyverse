import docsHtml from '../../../docs/index.html?raw';
import { redirect } from '@sveltejs/kit';

export function GET({ url }: { url: URL }) {
	if (!url.pathname.endsWith('/')) {
		throw redirect(308, `${url.pathname}/`);
	}

	return new Response(docsHtml, {
		headers: {
			'content-type': 'text/html; charset=utf-8'
		}
	});
}