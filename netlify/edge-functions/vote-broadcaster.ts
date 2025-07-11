// 파일 경로: /grl-vote-app/netlify/edge-functions/vote-broadcaster.ts

import type { Context } from "@netlify/functions";

// 서버에 연결된 모든 클라이언트(웹소켓)를 저장하는 맵
const server = new Map<string, WebSocket>();
// 메모리에 번호별 득표수를 저장하는 맵 (DB 대신 사용)
let voteCounts = new Map<number, number>();

export default async (request: Request, context: Context) => {
  const { pathname } = new URL(request.url);

  // --- 1. WebSocket 연결 요청 처리 ('/ws' 경로) ---
  if (pathname.startsWith("/ws")) {
    const { response, socket } = Deno.upgradeWebSocket(request);

    socket.onopen = () => {
      const socketId = crypto.randomUUID();
      server.set(socketId, socket);
      console.log(`[Socket] 클라이언트 연결 성공: ${socketId}`);
      // 새로 연결된 클라이언트에게 현재 투표 현황을 즉시 전송
      socket.send(JSON.stringify({ type: 'initial_state', data: Object.fromEntries(voteCounts) }));
    };

    socket.onclose = () => {
      for (const [id, s] of server.entries()) {
        if (s === socket) {
          server.delete(id);
          console.log(`[Socket] 클라이언트 연결 끊김: ${id}`);
          break;
        }
      }
    };
    
    // Netlify가 요청을 웹소켓으로 업그레이드하도록 응답 반환
    return response;
  }

  // --- 2. Tally.so Webhook 요청 처리 ('/tally-hook' 경로) ---
  if (pathname.startsWith("/tally-hook") && request.method === 'POST') {
    try {
      const payload = await request.json();
      const votedNumber = payload.data.fields[0].value as number;

      if (typeof votedNumber !== 'number') {
        return new Response("유효하지 않은 번호입니다.", { status: 400 });
      }

      const currentVotes = voteCounts.get(votedNumber) || 0;
      voteCounts.set(votedNumber, currentVotes + 1);

      console.log(`[Webhook] '${votedNumber}'번 투표 접수. 현재 득표수: ${voteCounts.get(votedNumber)}`);
      
      // 연결된 모든 클라이언트에게 새 투표 소식을 방송(브로드캐스트)
      for (const socket of server.values()) {
        socket.send(JSON.stringify({ type: 'new_vote', data: { number: votedNumber, votes: voteCounts.get(votedNumber) } }));
      }
      return new Response("웹훅 처리 및 방송 완료.", { status: 200 });

    } catch (error) {
      console.error("[Webhook] 에러:", error);
      return new Response("웹훅 처리 중 에러 발생.", { status: 500 });
    }
  }

  // --- 3. 투표 리셋 요청 처리 ('/reset' 경로) ---
  if (pathname.startsWith("/reset") && request.method === 'POST') {
    voteCounts.clear(); // 메모리의 모든 투표 기록 삭제
    console.log("[Reset] 모든 투표가 초기화되었습니다.");

    for (const socket of server.values()) {
        socket.send(JSON.stringify({ type: 'reset' }));
    }
    return new Response("투표가 성공적으로 초기화되었습니다.", { status: 200 });
  }

  // 위 세 가지 경로 외의 다른 모든 요청은 Netlify의 기본 동작(정적 파일 서빙 등)을 따르도록 합니다.
  // context.next()를 호출하면 됩니다.
  return context.next();
};