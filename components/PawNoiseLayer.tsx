import React, { useEffect, useState, useRef } from 'react';
import type { PremiumUiThemeId } from '../types';
import { PET_SKINS } from '../config/petSkins.config';

interface PawParticle {
  id: number;
  x: number; // 뷰포트 기준 X (%)
  y: number; // 뷰포트 기준 Y (%)
  rotation: number; // 발자국 렌더링 실제 각도
  scale: number;
  opacity: number;
}

interface PawNoiseLayerProps {
  themeId: PremiumUiThemeId;
  enabled: boolean;
}

export const PawNoiseLayer: React.FC<PawNoiseLayerProps> = ({ themeId, enabled }) => {
  const [paws, setPaws] = useState<PawParticle[]>([]);
  const idCounter = useRef(0);

  // 고양이 보행 물리 엔진 상태 (곡선 걷기 및 진행 벡터 역추종용)
  const lastWalk = useRef<{
    x: number;
    y: number;
    angle: number; // 현재 진행 각도 (도)
    stepsRemaining: number;
    isLeft: boolean;
    curveVelocity: number; // 곡선 회전 가속도
  } | null>(null);

  const petDef = PET_SKINS.find(p => p.id === `skin_${themeId}`);

  useEffect(() => {
    if (!enabled) {
      setPaws([]);
      return;
    }

    const spawnPaw = () => {
      let nextX = 0;
      let nextY = 0;
      let nextAngle = 0;
      let finalRotation = 0;
      let isWalkContinuation = false;

      // 화면 종횡비 왜곡 보정 (X% 와 Y% 의 실제 픽셀 거리 찌그러짐 해소)
      const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 0.56;

      // 1. Cat Walk Track (연속 발자국) 판단
      if (lastWalk.current && lastWalk.current.stepsRemaining > 0) {
        const lw = lastWalk.current;
        
        // 고양이가 가던 방향에서 매 걸음 각도에 유기적인 섭동(Perturbation)을 주어 사인/코사인 곡선 형태로 아늑하게 회전시킴
        lw.curveVelocity += (Math.random() - 0.5) * 8;
        lw.curveVelocity = Math.max(-15, Math.min(15, lw.curveVelocity));
        
        const walkAngle = (lw.angle + lw.curveVelocity + 360) % 360;
        
        // 🐾 보폭을 아주 세밀하고 앙증맞게 최적화! (2.0% ~ 2.8%의 아기자기한 템포)
        const stepDist = 2.0 + Math.random() * 0.8; 
        const rad = (walkAngle * Math.PI) / 180;
        
        // 종횡비를 역산하여 화면 가로/세로 이동 거리의 왜곡을 방지
        const prevX = lw.x;
        const prevY = lw.y;
        nextX = prevX + stepDist * Math.cos(rad) * (1 / Math.max(0.4, aspect));
        nextY = prevY + stepDist * Math.sin(rad);
        
        // 🐾 고양이 팔자걸음 디테일: 발자국 진행축의 직교 방향으로 좌/우 발 간격을 벌려줌
        const perpRad = ((walkAngle + 90) * Math.PI) / 180;
        const sideOffset = 0.5 * (lw.isLeft ? -1 : 1);
        nextX += sideOffset * Math.cos(perpRad) * (1 / Math.max(0.4, aspect));
        nextY += sideOffset * Math.sin(perpRad);

        // 🐾 [기하 벡터 보정 엔진 핵심]: 이전 좌표(prevX, prevY)에서 다음 좌표(nextX, nextY)로 향하는 실진행 기하벡터 산출!
        // 화면 좌표상 가로/세로 퍼센트 단위이므로 종횡비를 곱해 픽셀 공간에서의 실제 물리 각도 구하기
        const dx = (nextX - prevX) * Math.max(0.4, aspect);
        const dy = nextY - prevY;
        
        // 이전 좌표와 다음 좌표 간의 평균 벡터각(도) 연산
        const vectorAngleRad = Math.atan2(dy, dx);
        const vectorAngleDeg = (vectorAngleRad * 180) / Math.PI;

        nextAngle = walkAngle;
        
        // 발가락 방향이 SVG 기본값상 위(북쪽, 270도)를 향하고 있으므로 진행각에 90도를 더해 진행 방향으로 발가락 정렬!
        // 여기에 앙증맞은 발걸음 팔자걸음 흔들림 각도(왼발 안쪽 -6도, 오른발 +6도)를 얹어주어 극한의 자연스러움 확보!
        const walkOffset = lw.isLeft ? -6 : 6;
        finalRotation = (vectorAngleDeg + 90 + walkOffset + 360) % 360;

        // 가장자리 탈출 방지
        if (nextX < 4 || nextX > 96 || nextY < 4 || nextY > 96) {
          lastWalk.current = null;
        } else {
          lw.x = nextX;
          lw.y = nextY;
          lw.angle = walkAngle;
          lw.stepsRemaining -= 1;
          lw.isLeft = !lw.isLeft;
          isWalkContinuation = true;
        }
      }

      // 2. 새로운 고양이 발자국 시작
      if (!isWalkContinuation) {
        nextX = 15 + Math.random() * 70;
        nextY = 15 + Math.random() * 70;
        nextAngle = Math.random() * 360;
        
        // 시작 시에는 북쪽 기준으로 진행 각도를 자연스럽게 바라보게 설정
        const walkOffset = Math.random() > 0.5 ? -6 : 6;
        finalRotation = (nextAngle + 90 + walkOffset + 360) % 360;

        lastWalk.current = {
          x: nextX,
          y: nextY,
          angle: nextAngle,
          stepsRemaining: 4 + Math.floor(Math.random() * 5),
          isLeft: Math.random() > 0.5,
          curveVelocity: (Math.random() - 0.5) * 8
        };
      }

      const scale = 0.65 + Math.random() * 0.15; // 앙증맞고 아담한 발자국 스케일

      const newPaw: PawParticle = {
        id: idCounter.current++,
        x: nextX,
        y: nextY,
        rotation: finalRotation,
        scale,
        opacity: 0.14
      };

      setPaws(prev => [...prev, newPaw]);

      setTimeout(() => {
        setPaws(prev => prev.filter(p => p.id !== newPaw.id));
      }, 3500);
    };

    spawnPaw();

    let timerId: NodeJS.Timeout;
    const tick = () => {
      spawnPaw();
      const nextDelay = 400 + Math.random() * 250; // 조금 더 밀도있고 아장아장 걷게 템포 최적화
      timerId = setTimeout(tick, nextDelay);
    };
    
    timerId = setTimeout(tick, 600);

    return () => {
      clearTimeout(timerId);
    };
  }, [enabled, themeId]);

  if (!enabled || paws.length === 0) return null;
  const pawColor = petDef?.colors.uiTextMuted ?? petDef?.colors.earOuter ?? '#FFC69F';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0, // 최하단 백그라운드 레이어
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes pawFadeInOut {
          0% {
            opacity: 0;
            transform: scale(0.2) translate(-50%, -50%);
          }
          10% {
            opacity: 1;
            transform: scale(1) translate(-50%, -50%);
          }
          80% {
            opacity: 1;
            transform: scale(1) translate(-50%, -50%);
          }
          100% {
            opacity: 0;
            transform: scale(0.55) translate(-50%, -50%);
          }
        }
      `}</style>
      {paws.map(paw => (
        <div
          key={paw.id}
          style={{
            position: 'absolute',
            left: `${paw.x}%`,
            top: `${paw.y}%`,
            color: pawColor,
            transform: `translate(-50%, -50%) rotate(${paw.rotation}deg) scale(${paw.scale})`,
            transformOrigin: '50% 50%', // 회전 중심점 고정
            animation: 'pawFadeInOut 3.5s ease-in-out forwards',
            opacity: paw.opacity,
            imageRendering: 'pixelated',
          }}
        >
          {/* 🐾 정밀하게 다듬어진 고양이 발바닥 픽셀 아트 */}
          <svg width="22" height="18" viewBox="0 0 12 10" fill="currentColor">
            {/* 큰 메인 패드 */}
            <rect x="3" y="4.5" width="6" height="3.5" rx="1.5" />
            <rect x="2" y="5.5" width="8" height="2" rx="0.5" />
            {/* 앙증맞은 고양이 발가락 (진행각인 위를 명확히 지목하는 형상) */}
            <rect x="1.5" y="2.5" width="2" height="2.2" rx="0.5" />
            <rect x="4" y="0.8" width="1.7" height="2.2" rx="0.5" />
            <rect x="6.3" y="0.8" width="1.7" height="2.2" rx="0.5" />
            <rect x="8.5" y="2.5" width="2" height="2.2" rx="0.5" />
          </svg>
        </div>
      ))}
    </div>
  );
};
