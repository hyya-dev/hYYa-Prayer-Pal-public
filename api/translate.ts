import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Backend proxy for Google Cloud Translation API.
 * This prevents the API key from being exposed to the client.
 */
export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const { q, target, source } = request.body;

  if (!q) {
    return response.status(400).json({ error: 'Missing query text (q)' });
  }

  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;

  if (!apiKey) {
    console.error('GOOGLE_TRANSLATE_API_KEY is not configured in the environment.');
    return response.status(500).json({ error: 'Translation service configuration error' });
  }

  try {
    const url = new URL('https://translation.googleapis.com/language/translate/v2');
    url.searchParams.append('key', apiKey);

    const googleResponse = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q,
        target: target || 'en',
        source: source || undefined,
        format: 'text',
      }),
    });

    const data = await googleResponse.json();

    if (!googleResponse.ok) {
      console.error('Google Translation API error:', data);
      return response.status(googleResponse.status).json({
        error: data.error?.message || 'Failed to translate via Google Cloud',
      });
    }

    return response.status(200).json(data);
  } catch (error) {
    console.error('Server error during translation:', error);
    return response.status(500).json({ error: 'Internal server error' });
  }
}
