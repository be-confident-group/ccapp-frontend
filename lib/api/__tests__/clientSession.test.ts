// The API client must only end the session when the server rejects the token
// that is actually stored — never because secure storage was unreadable.
process.env.EXPO_PUBLIC_API_URL = 'https://api.test';

jest.mock('../tokenStorage', () => ({
  readAuthToken: jest.fn(),
  deleteAuthToken: jest.fn(),
}));

function setup() {
  let client: typeof import('../client').apiClient;
  let storage: jest.Mocked<typeof import('../tokenStorage')>;
  jest.isolateModules(() => {
    client = require('../client').apiClient;
    storage = require('../tokenStorage');
  });
  const onUnauthorized = jest.fn();
  client!.setOnUnauthorized(onUnauthorized);
  const fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
  return { client: client!, storage: storage!, onUnauthorized, fetchMock };
}

const unauthorized = { ok: false, status: 401, statusText: 'Unauthorized', text: async () => '' };

describe('apiClient session handling', () => {
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('does not send the request or sign out when storage is unreadable', async () => {
    const { client, storage, onUnauthorized, fetchMock } = setup();
    storage.readAuthToken.mockRejectedValue(new Error('device locked'));

    await expect(client.get('/api/trips/')).rejects.toThrow('device locked');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(storage.deleteAuthToken).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('signs out once when the server rejects the stored token', async () => {
    const { client, storage, onUnauthorized, fetchMock } = setup();
    storage.readAuthToken.mockResolvedValue('abc');
    fetchMock.mockResolvedValue(unauthorized);

    await expect(client.get('/api/trips/')).rejects.toThrow('Session expired');
    await expect(client.get('/api/profile/')).rejects.toThrow('Session expired');
    expect(storage.deleteAuthToken).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('keeps a newer token when a 401 arrives for an older one', async () => {
    const { client, storage, onUnauthorized, fetchMock } = setup();
    storage.readAuthToken.mockResolvedValueOnce('old').mockResolvedValue('new');
    fetchMock.mockResolvedValue(unauthorized);

    await expect(client.get('/api/trips/')).rejects.toThrow('Session expired');
    expect(storage.deleteAuthToken).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('signs out without calling the server when no token is stored', async () => {
    const { client, storage, onUnauthorized, fetchMock } = setup();
    storage.readAuthToken.mockResolvedValue(null);

    await expect(client.get('/api/trips/')).rejects.toThrow('Session expired');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
