// 파일 경로: script.js (이 코드 전체를 복사해서 사용하세요)

// --- 1. 초기 설정: 모듈 임포트 및 Supabase 클라이언트 생성 ---
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://wqxmvqqkbxiykiotbusd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxeG12cXFrYnhpeWtpb3RidXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg0NDcyOTYsImV4cCI6MjA2NDAyMzI5Nn0.RmB92YtjLPMx4tkQibuRVT_T4DL3_O8Pny3ZA9DU0tk';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);


// --- 2. D3.js 시각화 설정 및 전역 변수 ---
const width = window.innerWidth;
const height = window.innerHeight;

const svg = d3.select("#viz").append("svg").attr("width", width).attr("height", height);
const g = svg.append("g"); // 줌/패닝을 위한 그룹
const defs = svg.append("defs");

// 드롭섀도우 필터 정의
defs.append("filter")
  .attr("id", "dropshadow")
  .attr("x", "-20%").attr("y", "-20%")
  .attr("width", "140%").attr("height", "140%")
  .append("feDropShadow")
    .attr("dx", 2).attr("dy", 2).attr("stdDeviation", 2)
    .attr("flood-color", "rgba(0,0,0,0.5)");

defs.append("filter")
  .attr("id", "highlight-blur")
  .append("feGaussianBlur")
    .attr("in", "SourceGraphic")
    .attr("stdDeviation", 5); 

// 라디얼 그라디언트 정의
const grad = defs.append("radialGradient")
  .attr("id", "circle-gradient")
  .attr("cx", "30%").attr("cy", "30%").attr("r", "70%");
grad.append("stop").attr("offset","0%").attr("stop-color","rgba(255,255,255,0.8)");
grad.append("stop").attr("offset","60%").attr("stop-color","rgba(255,255,255,0.1)");
grad.append("stop").attr("offset","100%").attr("stop-color","rgba(255,255,255,0)");

const simulation = d3.forceSimulation()
    .force("center", d3.forceCenter(width / 2, height / 2).strength(0.7))
    .force("charge", d3.forceManyBody().strength(30))
    .force("collide", d3.forceCollide().radius(d => d.radius + 3))
    .on("tick", ticked);

let nodeData = []; // 현재 노드 데이터를 저장할 배열 (전역으로 관리)


// --- 3. 핵심 함수 선언 ---

/** D3 시뮬레이션의 매 프레임마다 호출되어 화면의 요소 위치를 업데이트합니다. */
function ticked() {
    g.selectAll("g.node").attr("transform", d => `translate(${d.x}, ${d.y})`);
}

/**
 * 가공된 노드 데이터를 받아서, 실제 화면에 원과 텍스트를 그리거나 업데이트합니다.
 */
function updateD3(processedNodes) {
    // 데이터 바인딩: 'number'를 고유 키로 사용합니다.
    const circles = g.selectAll("g.node").data(processedNodes, d => d.number);

    // (Exit) 사라질 원(그룹) 처리: 부드럽게 작아지며 사라짐
    circles.exit().transition().duration(500).attr("transform", "scale(0)").remove();

    // (Enter) 새로 생길 원(그룹) 생성
    const newGroups = circles.enter().append("g").attr("class", "node").attr("transform", d => `translate(${d.x}, ${d.y})`);

    // 그룹 안에 원과 텍스트 추가
    newGroups.append("circle").attr("r", 0).style("fill", d => d3.interpolateTurbo(d.number / 20)).style("stroke", "#333").style("stroke-width", 2.5);
    newGroups.append("text").attr("class", "label").attr("dy", ".3em").text(d => d.number);

    // 메인 원(circle)에 드롭섀도우 필터 적용
    newGroups.append("circle")
      .attr("r", 0)
      .style("fill", d => d3.interpolateTurbo(d.number / 20))
      .style("stroke", "#333")
      .style("stroke-width", 2.5)
      .attr("filter", "url(#dropshadow)");

    // (선택) 하이라이트용 작은 서브 서클
    newGroups.append("circle")
      .attr("class", "highlight")
      .attr("r", d => d.radius * 0.4)
      .attr("cx", d => -d.radius * 0.3)
      .attr("cy", d => -d.radius * 0.3)
      .style("fill", "rgba(255,255,255,0.3)")
      .attr("filter", "url(#highlight-blur)");  // ← 여기서 Blur 필터를 적용!

    // (Update) 기존 원과 새로 생긴 원 모두 업데이트
    const allGroups = newGroups.merge(circles);
    
    // 반지름을 목표 크기로 부드럽게 변경
    allGroups.select("circle").transition().duration(400).attr("r", d => d.radius);

    // 시뮬레이션에 새로운 노드 데이터 전달 및 재시작
    simulation.nodes(processedNodes);
    simulation.alpha(1).restart();
    
    // 전역 nodeData를 최신 상태로 업데이트
    nodeData = processedNodes;
}

/**
 * DB에서 최신 'votes' 데이터를 가져와서
 * D3.js가 사용할 수 있는 형태로 가공하고,
 * 최종적으로 화면 업데이트 함수(updateD3)를 호출합니다.
 */
async function syncDataAndRender() {
    console.log("Fetching latest data...");

    const { data: votes, error } = await supabase.from("votes").select("voted_for_number");
    if (error) {
        console.error("Failed to fetch votes:", error);
        return;
    }

    const counts = d3.rollup(votes, v => v.length, d => d.voted_for_number);
    const oldNodeMap = new Map(nodeData.map(d => [d.number, d]));

    const processedNodes = Array.from(counts, ([number, count]) => {
        const radius = 20 + Math.log2(count + 1) * 25;
        const oldNode = oldNodeMap.get(String(number));
        return {
            number: String(number),
            count: count,
            radius: radius,
            x: oldNode ? oldNode.x : width / 2 + (Math.random() - 0.5) * 50,
            y: oldNode ? oldNode.y : height / 2 + (Math.random() - 0.5) * 50,
        };
    });
    
    // 가공된 최종 노드 데이터로 화면 업데이트 함수 호출
    updateD3(processedNodes);
}

function createStars() {
    const container = document.getElementById('star-field');
    if (!container) return;

    // 동적으로 생성된 스타일을 담을 <style> 태그를 head에 추가합니다.
    // 이렇게 하면 각 별마다 다른 애니메이션을 정의할 수 있습니다.
    const styleSheet = document.createElement("style");
    document.head.appendChild(styleSheet);

    const starCount = 300; // 별 개수 (너무 많으면 성능에 영향을 줄 수 있음)

    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        
        // --- 1. 별의 기본 스타일 설정 ---
        star.className = 'star';
        const size = Math.random() * 2.5 + 2; // 1px ~ 3.5px 크기
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        // 시작 위치는 항상 화면 중앙
        star.style.left = '50%';
        star.style.top = '50%';
        
        // --- 2. 각 별의 고유한 애니메이션 정의 ---
        // 무작위 방향 (360도) 설정
        const angle = Math.random() * 360;
        // 퍼져나갈 거리 (화면 대각선 길이의 절반 정도)
        const distance = Math.hypot(width, height) / 2;

        // 최종 도착 지점의 x, y 좌표 계산
        const endX = Math.cos(angle * Math.PI / 180) * distance;
        const endY = Math.sin(angle * Math.PI / 180) * distance;

        // 각 별마다 고유한 애니메이션 이름 생성 (예: move-star-1, move-star-2)
        const animationName = `move-star-${i}`;
        
        // @keyframes 규칙을 문자열로 생성
        const keyframes = `
            @keyframes ${animationName} {
                from {
                    transform: translate(-50%, -50%) scale(0.5);
                    opacity: 1;
                }
                to {
                    transform: translate(calc(-50% + ${endX}px), calc(-50% + ${endY}px)) scale(1.5);
                    opacity: 0;
                }
            }
        `;
        
        // 생성된 @keyframes 규칙을 <style> 태그에 추가
        styleSheet.sheet.insertRule(keyframes, styleSheet.sheet.cssRules.length);

        // --- 3. 별에 애니메이션 속성 적용 ---
        const duration = Math.random() * 30 + 15; // 5초 ~ 10초
        const delay = Math.random() * 10; // 0초 ~ 10초 후 시작

        star.style.animation = `${animationName} ${duration}s ${delay}s linear infinite`;

        // 생성된 별을 컨테이너에 추가
        container.appendChild(star);
    }
}


// --- 4. 실행 시작 ---

/** 모든 것을 시작하는 메인 함수 */
async function main() {

    createStars();
    // 1. 페이지 로드 시, 즉시 최신 데이터로 화면을 그립니다.
    await syncDataAndRender(); 
    
    // 2. 3초마다 syncDataAndRender 함수를 반복해서 호출하여 실시간처럼 보이게 합니다.
    setInterval(syncDataAndRender, 2000); // 3000ms = 3초
    
    console.log("Polling started: fetching data every 3 seconds.");
}

// 메인 함수 실행
main();
