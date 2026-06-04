export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const fallback = `Request failed: ${response.status}`;
    try {
      const body = await response.json();
      throw new Error(body.error?.message ?? fallback);
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(fallback);
    }
  }

  return response.json() as Promise<T>;
}
