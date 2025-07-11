import { createClient } from '@supabase/supabase-js';

// 환경변수에서 불러오기
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Tally Webhook → POST JSON 호출
export async function handler(event) {
  try {
    const payload = JSON.parse(event.body);
    // Tally 응답 구조에 따라 필드명 조정하세요
    const voteValue = parseInt(payload.data['투표 숫자'], 10);

    if (Number.isInteger(voteValue)) {
      await supabase
        .from('votes')
        .insert({ value: voteValue });
    }

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: 'Error' };
  }
}
