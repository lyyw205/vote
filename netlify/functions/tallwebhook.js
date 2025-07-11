// tallywebhook.js (수정 후)

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export async function handler(event) {
  try {
    const payload = JSON.parse(event.body);
    // Tally.so 응답 구조는 보통 fields 배열 형태입니다.
    // 첫 번째 필드의 값을 가져오는 것이 더 안정적입니다.
    const voteValue = parseInt(payload.data.fields[0].value, 10);

    if (isNaN(voteValue)) {
        // 숫자가 아닌 값이 들어오면 에러 처리
        throw new Error('Submitted value is not a number.');
    }

    // ★★★ 핵심 수정: 'voted_for_number' 컬럼에 데이터를 삽입합니다. ★★★
    const { data, error } = await supabase
      .from('votes')
      .insert({ voted_for_number: voteValue });

    // Supabase에서 에러가 발생했는지 확인하고 로그를 남깁니다.
    if (error) {
        console.error('Supabase insert error:', error);
        throw error;
    }

    return { statusCode: 200, body: 'OK' };

  } catch (err) {
    console.error('Handler error:', err);
    return { statusCode: 500, body: err.message };
  }
}