// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    const stage = input?.stage || 'dev';
    // Use unique app names to avoid SST lock issues across stages
    return {
      name: 'aiready-landing-' + stage,
      removal: stage === 'production' ? 'retain' : 'remove',
      home: 'aws',
      providers: {
        aws: {
          version: '7.20.0',
        },
      },
      defaults: {
        function: {
          runtime: 'nodejs22.x',
        },
      },
    };
  },
  async run() {
    const cloudflareZoneId = '50eb7dcadc84c58ab34583742db0b671';

    const isProduction = $app.stage === 'production';
    const isDev = $app.stage === 'dev';
    const isPersonal = $app.stage === 'personal';
    const domainName = isProduction
      ? 'getaiready.dev'
      : isPersonal
        ? 'backup.getaiready.dev'
        : 'dev.getaiready.dev';

    // Storage for report submissions
    const submissions = new sst.aws.Bucket('SubmissionsV3', {
      public: false,
      versioned: false,
    });

    // SES domain identity - managed only for production to avoid conflicts
    const defaultSesFromEmail = `notifications@${domainName}`;

    // For production, don't try to create SES identity - it already exists
    // For dev, optionally create if requested
    const _manageSesDomainIdentity =
      isProduction && process.env.SES_MANAGE_DOMAIN_IDENTITY === 'true';

    const emailDomain = domainName;

    // API Gateway HTTP API for public form submissions
    const api = new sst.aws.ApiGatewayV2('RequestApi', {
      cors: true,
    });

    api.route('POST /', {
      handler: 'api/request-report.handler',
      link: [submissions],
      environment: {
        SUBMISSIONS_BUCKET: submissions.name,
        SES_TO_EMAIL: process.env.SES_TO_EMAIL || '',
        SES_FROM_EMAIL: process.env.SES_FROM_EMAIL || defaultSesFromEmail,
        SES_CONFIGURATION_SET:
          'aiready-landing-production-notificationemailconfig-ttxwnzxe',
      },
      permissions: [
        {
          actions: ['ses:SendEmail', 'ses:SendRawEmail'],
          resources: ['*'],
        },
      ],
    });

    // Static site deployment - use custom domain for production, dev and personal
    const useCustomDomain = isProduction || isDev || isPersonal;

    if (isPersonal) {
      const redirectFunc = new sst.aws.Function('RedirectLambda', {
        handler: 'functions/redirect.handler',
        url: true,
      });

      /*
      // Point root domain to Lambda URL
      new sst.cloudflare.dns.Record('RootDnsRecord', {
        zone: cloudflareZoneId,
        name: 'getaiready.dev',
        type: 'CNAME',
        value: redirectFunc.url.apply(url => new URL(url).hostname),
        proxied: true,
      });
      */
    }

    const site = new sst.aws.StaticSite('AireadyLanding', {
      path: './',
      build: {
        command: 'pnpm build',
        output: 'out',
      },
      environment: {
        NEXT_PUBLIC_REQUEST_URL: api.url,
      },
      ...(useCustomDomain && {
        domain: {
          name: domainName,
          redirects: isProduction ? ['www.getaiready.dev'] : undefined,
          dns: sst.cloudflare.dns({
            zone: cloudflareZoneId,
            proxy: true,
          }),
        },
      }),
      invalidation: {
        paths: ['/*'],
        wait: true,
      },
    });

    const siteUrl = site.url;

    return {
      site: siteUrl,
      apiUrl: api.url,
      submissionsBucket: submissions.name,
      emailDomain: emailDomain,
    };
  },
});
