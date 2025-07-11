// 1) Supabase 클라이언트 세팅
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const SUPABASE_URL = 'https://<your-project>.supabase.co';
const SUPABASE_KEY = '<your-anon-key>';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 2) D3 시뮬레이션 설정
const width = window.innerWidth, height = window.innerHeight;
const R = Math.min(width, height) / 2;
const svg = d3.select('#viz')
  .append('svg')
    .attr('width', width)
    .attr('height', height)
  .append('g')
    .attr('transform', `translate(${width/2},${height/2})`);

let counts = {}, nodes = [], circles;
const simulation = d3.forceSimulation(nodes)
  .force('center', d3.forceCenter(0, 0))
  .force('collision', d3.forceCollide(d => d.size/2 + 2))
  .alphaDecay(0.02)
  .on('tick', () => {
    nodes.forEach(d => {
      const dist = Math.hypot(d.x, d.y);
      const max = R - d.size/2;
      if (dist > max) {
        const theta = Math.atan2(d.y, d.x);
        d.x = Math.cos(theta) * max;
        d.y = Math.sin(theta) * max;
      }
    });
    circles.attr('cx', d => d.x).attr('cy', d => d.y);
  });

// 3) 초기 데이터 불러오기
async function init() {
  const { data, error } = await supabase.from('votes').select('value');
  if (error) return console.error(error);
  data.forEach(r => counts[r.value] = (counts[r.value]||0) + 1);
  updateVisualization();
  subscribeRealtime();
}
init();

// 4) Realtime 구독
function subscribeRealtime() {
  supabase
    .from('votes')
    .on('INSERT', payload => {
      const v = payload.new.value;
      counts[v] = (counts[v]||0) + 1;
      updateVisualization();
    })
    .subscribe();
}

// 5) 시각화 업데이트
function updateVisualization() {
  nodes = Object.entries(counts)
    .filter(([_, c]) => c>0)
    .map(([value, count]) => ({
      value, count,
      size: 30 + Math.sqrt(count)*20,
      x: (Math.random()-0.5)*R, y: (Math.random()-0.5)*R
    }));

  circles = svg.selectAll('circle.ball')
    .data(nodes, d => d.value);

  circles.exit().remove();
  circles = circles.enter()
    .append('circle')
      .attr('class','ball')
      .attr('r', d => d.size/2)
      .attr('fill', d => d3.hsl((+d.value*40)%360,0.7,0.5))
      .attr('opacity',0.8)
    .merge(circles);

  simulation.nodes(nodes);
  simulation.force('collision', d3.forceCollide(d => d.size/2+2));
  simulation.alpha(1).restart();
}
