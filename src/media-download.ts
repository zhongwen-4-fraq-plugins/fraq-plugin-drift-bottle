export async function retryMediaDownload<T>(operation: () => Promise<T>, retryDelayMs = 500): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'AI_DownloadError' || attempt >= 3) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
    }
  }
}
