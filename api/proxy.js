// api/proxy.js
export default async function handler(req, res) {
  // Vercel 환경 변수에 저장해둔 구글 스크립트 주소를 불러옵니다.
  const GAS_URL = process.env.VITE_APP_DATA_API_URL;

  if (!GAS_URL) {
    return res.status(500).json({ error: '구글 API URL이 Vercel 환경변수에 없습니다.' });
  }

  try {
    if (req.method === 'GET') {
      // Vercel 서버가 대신 구글 시트를 찔러서 데이터를 가져옵니다 (차단 우회)
      const response = await fetch(GAS_URL);
      const data = await response.text();
      return res.status(200).send(data);
    }

    if (req.method === 'POST') {
      const bodyString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: bodyString,
      });
      const data = await response.text();
      return res.status(200).send(data);
    }

    return res.status(405).json({ error: '허용되지 않은 메서드입니다.' });
  } catch (error) {
    return res.status(500).json({ error: String(error) });
  }
}