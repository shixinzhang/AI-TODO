import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * POST /api/text-to-speech - 文字转语音（使用 Minimax TTS）
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Missing text' });
    }

    const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
    if (!MINIMAX_API_KEY) {
      return res.status(500).json({ error: 'MINIMAX_API_KEY is not configured' });
    }

    // 调用 Minimax TTS API
    const response = await fetch('https://api.minimax.chat/v1/text_to_speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MINIMAX_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'speech-01',
        text,
        voice_id: 'male-qn-qingse',
        speed: 1.0,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error: `Minimax API error: ${error}` });
    }

    // 返回音频流
    const audioBuffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    return res.send(Buffer.from(audioBuffer));
  } catch (error: any) {
    console.error('Text-to-speech error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}


