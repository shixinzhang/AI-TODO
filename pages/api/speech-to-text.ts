import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';

/**
 * POST /api/speech-to-text - 语音转文字（使用 OpenAI Whisper）
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
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
    }

    // 解析 multipart/form-data
    const form = formidable({
      maxFileSize: 25 * 1024 * 1024, // 25MB
    });

    const [fields, files] = await form.parse(req);
    const audioFile = Array.isArray(files.audio) ? files.audio[0] : files.audio;

    if (!audioFile) {
      return res.status(400).json({ error: 'Missing audio file' });
    }

    // 读取文件
    const fileBuffer = fs.readFileSync(audioFile.filepath);
    const fileBlob = new Blob([fileBuffer], { type: audioFile.mimetype || 'audio/webm' });

    // 调用 Whisper API
    const formData = new FormData();
    formData.append('file', fileBlob, audioFile.originalFilename || 'audio.webm');
    formData.append('model', 'whisper-1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error: `OpenAI API error: ${error}` });
    }

    const data = await response.json();

    // 清理临时文件
    fs.unlinkSync(audioFile.filepath);

    return res.status(200).json({ text: data.text });
  } catch (error: any) {
    console.error('Speech-to-text error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}

export const config = {
  api: {
    bodyParser: false, // 禁用默认的 bodyParser，使用 formidable
  },
};

