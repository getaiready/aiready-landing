export const handler = async (event: any) => {
  const host = event.headers.host || '';
  let target = 'https://backup.getaiready.dev';

  if (host.includes('clawmore.ai')) {
    target = 'https://backup.clawmore.ai';
  }

  return {
    statusCode: 301,
    headers: {
      Location:
        target +
        (event.rawPath || '/') +
        (event.rawQueryString ? '?' + event.rawQueryString : ''),
    },
  };
};
