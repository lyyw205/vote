// script.js (수정 후)

// 1) Supabase 클라이언트 세팅 (이 부분은 그대로)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const SUPABASE_URL = 'https://<your-project>.supabase.co'; // ★본인 정보로 교체★
const SUPABASE_KEY = '<your-anon-key>'; // ★본인 정보로 교체★
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 2) D3 시뮬레이션 설정 (이 부분은 그대로)
// ... (width, height, svg, simulation 설정) ...

// 3) 초기 데이터 불러오기 (수정)
async function init() {
  // ★★★ 수정: 'value' 대신 'voted_for_number'를 조회합니다.
  const { data, error } = await supabase.from('votes').select('voted_for_number');
  if (error) return console.error(error);
  
  // ★★★ 수정: row.value 대신 row.voted_for_number를 사용합니다.
  data.forEach(row => {
    counts[row.voted_for_number] = (counts[row.voted_for_number] || 0) + 1;
  });

  updateVisualization();
  subscribeRealtime();
}
init();

// 4) Realtime 구독 (수정)
function subscribeRealtime() {
  supabase
    .channel('public:votes') // 채널 이름을 지정해주는 것이 좋습니다.
    .on(
      'postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'votes' }, 
      payload => {
        // ★★★ 수정: payload.new.value 대신 payload.new.voted_for_number를 사용합니다.
        const v = payload.new.voted_for_number;
        counts[v] = (counts[v] || 0) + 1;
        updateVisualization();
      }
    )
    .subscribe();
}

// 5) 시각화 업데이트 (수정)
function updateVisualization() {
    // nodes 데이터 구조를 'value'에서 'number'로 변경하여 의미를 명확히 합니다.
    nodes = Object.entries(counts)
        .filter(([_, count]) => count > 0)
        .map(([number, count]) => ({
            number: number, // 'value' 대신 'number'
            count: count,
            size: 30 + Math.sqrt(count) * 20,
            x: (Math.random() - 0.5) * R,
            y: (Math.random() - 0.5) * R
        }));
    
    // d3.js 코드에서 사용하는 키도 'value'에서 'number'로 변경합니다.
    circles = svg.selectAll('circle.ball')
        .data(nodes, d => d.number); // ★★★ 수정

    circles.exit().remove();
    
    circles = circles.enter()
        .append('circle')
        .attr('class', 'ball')
        .attr('r', 0) // 처음에는 반지름 0으로 시작
        .attr('fill', d => d3.hsl((+d.number * 40) % 360, 0.7, 0.5)) // ★★★ 수정
        .attr('opacity', 0.8)
        .merge(circles);

    // 반지름이 부드럽게 변하는 애니메이션 추가
    circles.transition()
        .duration(500) // 0.5초 동안
        .attr('r', d => d.size / 2);

    simulation.nodes(nodes);
    simulation.force('collision', d3.forceCollide(d => d.size / 2 + 2));
    simulation.alpha(1).restart();
}