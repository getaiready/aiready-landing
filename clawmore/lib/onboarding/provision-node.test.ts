import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProvisioningOrchestrator } from './provision-node';

// Mock AWS Vending
vi.mock('../aws/vending', () => ({
  findAvailableAccountInPool: vi.fn().mockResolvedValue(null),
  createManagedAccount: vi.fn().mockResolvedValue('req-123'),
  waitForAccountCreation: vi.fn().mockResolvedValue('acc-456'),
  bootstrapManagedAccount: vi
    .fn()
    .mockResolvedValue('arn:aws:iam::acc-456:role/ClawMore-Bootstrap-Role'),
  assumeSubAccountRole: vi.fn().mockResolvedValue({
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    sessionToken: 'test-token',
  }),
}));

// Mock AWS Governance
vi.mock('../aws/governance', () => ({
  createServerlessSCP: vi.fn().mockResolvedValue('scp-789'),
  attachSCPToAccount: vi.fn().mockResolvedValue({}),
}));

// Mock DB
vi.mock('../db', () => ({
  createManagedAccountRecord: vi.fn().mockResolvedValue({}),
  ensureUserMetadata: vi.fn().mockResolvedValue({}),
  updateProvisioningStatus: vi.fn().mockResolvedValue({}),
}));

// Mock Libsodium
vi.mock('libsodium-wrappers', () => ({
  default: {
    ready: Promise.resolve(),
    from_base64: vi.fn().mockReturnValue(new Uint8Array()),
    from_string: vi.fn().mockReturnValue(new Uint8Array()),
    crypto_box_seal: vi.fn().mockReturnValue(new Uint8Array()),
    to_base64: vi.fn().mockReturnValue('encrypted-value'),
    base64_variants: { ORIGINAL: 1 },
  },
}));

describe('ProvisioningOrchestrator', () => {
  let orchestrator: ProvisioningOrchestrator;
  let mockOctokit: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockOctokit = {
      users: {
        getAuthenticated: vi
          .fn()
          .mockResolvedValue({ data: { login: 'testuser' } }),
      },
      repos: {
        createUsingTemplate: vi.fn().mockResolvedValue({
          data: {
            owner: { login: 'testuser' },
            html_url: 'https://github.com/testuser/test-repo',
          },
        }),
      },
      actions: {
        getRepoPublicKey: vi.fn().mockResolvedValue({
          data: { key: 'dGVzdC1wdWJsaWMta2V5', key_id: 'key-123' },
        }),
        createOrUpdateRepoSecret: vi.fn().mockResolvedValue({}),
      },
    };

    orchestrator = new ProvisioningOrchestrator(
      'fake-token',
      mockOctokit as any
    );
  });

  it('should orchestrate the full provisioning loop successfully', async () => {
    const options = {
      userEmail: 'test@example.com',
      userName: 'Test User',
      repoName: 'test-repo',
      githubToken: 'fake-token',
      coEvolutionOptIn: true,
    };

    const result = await orchestrator.provisionNode(options);

    expect(result).toEqual(
      expect.objectContaining({
        accountId: 'acc-456',
        repoUrl: 'https://github.com/testuser/test-repo',
        roleArn: 'arn:aws:iam::acc-456:role/ClawMore-Bootstrap-Role',
      })
    );

    // Verify GitHub calls
    expect(mockOctokit.repos.createUsingTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'test-repo',
        template_owner: 'caopengau',
        template_repo: 'serverlessclaw',
      })
    );

    // Verify Secret Injection (4 base secrets)
    expect(mockOctokit.actions.createOrUpdateRepoSecret).toHaveBeenCalledTimes(
      4
    );

    // Verify DB Persistence
    const { createManagedAccountRecord, ensureUserMetadata } =
      await import('../db');
    expect(createManagedAccountRecord).toHaveBeenCalledWith({
      awsAccountId: 'acc-456',
      ownerEmail: 'test@example.com',
      repoName: 'test-repo',
    });
    expect(ensureUserMetadata).toHaveBeenCalledWith('test@example.com');
  });

  it('should inject SST secrets when provided', async () => {
    const options = {
      userEmail: 'test@example.com',
      userName: 'Test User',
      repoName: 'test-repo',
      githubToken: 'fake-token',
      coEvolutionOptIn: false,
      sstSecrets: {
        TelegramBotToken: 'bot-token-123',
        MiniMaxApiKey: 'minimax-key-456',
        GitHubToken: 'gh-token-789',
      },
    };

    const result = await orchestrator.provisionNode(options);

    expect(result.accountId).toBe('acc-456');

    // 4 base secrets + 3 SST secrets = 7 total
    expect(mockOctokit.actions.createOrUpdateRepoSecret).toHaveBeenCalledTimes(
      7
    );

    // Verify SST secrets were injected with SST_SECRET_ prefix
    const secretCalls = mockOctokit.actions.createOrUpdateRepoSecret.mock.calls;
    const secretNames = secretCalls.map((call: any) => call[0].secret_name);
    expect(secretNames).toContain('SST_SECRET_TelegramBotToken');
    expect(secretNames).toContain('SST_SECRET_MiniMaxApiKey');
    expect(secretNames).toContain('SST_SECRET_GitHubToken');
  });

  it('should skip SST secrets when not provided', async () => {
    const options = {
      userEmail: 'test@example.com',
      userName: 'Test User',
      repoName: 'test-repo',
      githubToken: 'fake-token',
      coEvolutionOptIn: true,
    };

    await orchestrator.provisionNode(options);

    // Only 4 base secrets, no SST secrets
    expect(mockOctokit.actions.createOrUpdateRepoSecret).toHaveBeenCalledTimes(
      4
    );
  });

  it('should skip empty SST secret values', async () => {
    const options = {
      userEmail: 'test@example.com',
      userName: 'Test User',
      repoName: 'test-repo',
      githubToken: 'fake-token',
      coEvolutionOptIn: true,
      sstSecrets: {
        TelegramBotToken: 'bot-token-123',
        MiniMaxApiKey: '', // empty, should be skipped
        GitHubToken: 'gh-token-789',
      },
    };

    await orchestrator.provisionNode(options);

    // 4 base secrets + 2 non-empty SST secrets = 6 total
    expect(mockOctokit.actions.createOrUpdateRepoSecret).toHaveBeenCalledTimes(
      6
    );
  });
});
