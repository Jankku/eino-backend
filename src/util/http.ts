const HTTP_TIMEOUT_MS = 15_000;

export class HttpError extends Error {
  status: number;
  statusText: string;

  constructor(status: number, statusText: string) {
    super(`Request failed with status ${status} ${statusText}`);
    this.name = 'HttpError';
    this.status = status;
    this.statusText = statusText;
  }
}

export const fetchResponse = async (
  url: string | URL,
  options: RequestInit = {},
): Promise<Response> => {
  const response = await fetch(url, {
    ...options,
    signal: options.signal ?? AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new HttpError(response.status, response.statusText);
  }
  return response;
};

export const fetchJson = async (url: string | URL): Promise<unknown> => {
  const response = await fetchResponse(url);
  return response.json();
};
