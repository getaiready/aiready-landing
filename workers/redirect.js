export default {
  async fetch(request) {
    const url = new URL(request.url);
    const domain = url.hostname;

    let target = 'https://backup.getaiready.dev';
    if (domain.includes('clawmore.ai')) {
      target = 'https://backup.clawmore.ai';
    }

    return Response.redirect(target + url.pathname + url.search, 301);
  },
};
