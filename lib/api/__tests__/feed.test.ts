import { feedAPI } from '../feed';
import { apiClient } from '../client';

jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

const mockResponse = { count: 0, next: null, previous: null, results: [] };

describe('feedAPI.getFeed', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends page and page_size', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);
    await feedAPI.getFeed(2, 10);
    expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('page=2'));
    expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('page_size=10'));
  });

  it('includes type param when provided', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);
    await feedAPI.getFeed(1, 20, 'activities');
    expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('type=activities'));
  });

  it('omits type param when not provided', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);
    await feedAPI.getFeed(1, 20);
    const url: string = (apiClient.get as jest.Mock).mock.calls[0][0];
    expect(url).not.toContain('type=');
  });
});
