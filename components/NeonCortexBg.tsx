import { useEffect, useRef } from 'react';

/* ── Neon Cortex: Shibuya Cyberpunk Cityscape ──
   소실점 도로 + 건물면 + 대형 전광판 + 차량 라이트 트레일
   건물은 면(polygon)+창문 그리드로 표현, 점(dot) 패턴 없음 */

const VP_X = 0.55;
const VP_Y = 0.38;
const ROAD_W = 0.32;

interface Billboard {
  bx: number; by: number; bw: number; bh: number;
  text: string; color: 'cyan'|'magenta'|'amber'|'purple'|'blue';
  fontSize: number;
}

interface Trail {
  y: number; vx: number; life: number; maxLife: number;
  length: number; alpha: number;
  color: 'white'|'red'|'cyan'|'magenta';
  direction: -1|1;
}

function lerp(a: number, b: number, t: number): number { return a+(b-a)*t; }
function clamp(v: number, lo: number, hi: number): number { return v<lo?lo:v>hi?hi:v; }

function rlx(w: number, vpX: number, d: number): number { return vpX-w*ROAD_W*d; }
function rrx(w: number, vpX: number, d: number): number { return vpX+w*ROAD_W*d; }
function sy(h: number, vpY: number, d: number): number { return vpY+(h-vpY)*d; }
function depth(y: number, h: number, vpY: number): number { return clamp((y-vpY)/(h-vpY),0,1); }

/* ── Billboard on building face quad ── */
function drawBillboard(
  ctx: CanvasRenderingContext2D,
  tl: [number,number], tr: [number,number],
  br: [number,number], bl: [number,number],
  b: Billboard,
) {
  const blc = (xt: number, yt: number): [number, number] => {
    const x = lerp(b.bx, b.bx+b.bw, xt);
    const y = lerp(b.by, b.by+b.bh, yt);
    return [
      lerp(lerp(tl[0],tr[0],x), lerp(bl[0],br[0],x), y),
      lerp(lerp(tl[1],tr[1],x), lerp(bl[1],br[1],x), y),
    ];
  };
  const c = [blc(0,0), blc(1,0), blc(1,1), blc(0,1)];
  const minX = Math.min(...c.map(v=>v[0]));
  const minY = Math.min(...c.map(v=>v[1]));
  const maxX = Math.max(...c.map(v=>v[0]));
  const maxY = Math.max(...c.map(v=>v[1]));

  const sc = b.color==='cyan'?'#00e5ff':b.color==='magenta'?'#ff0080':
    b.color==='amber'?'#ffb300':b.color==='purple'?'#7000ff':'#0060ff';

  // Glow
  const gp = Math.max(maxX-minX, maxY-minY)*0.7;
  const gG = ctx.createRadialGradient((minX+maxX)/2,(minY+maxY)/2,0,(minX+maxX)/2,(minY+maxY)/2,gp);
  gG.addColorStop(0, sc+'33'); gG.addColorStop(1,'transparent');
  ctx.fillStyle = gG;
  ctx.fillRect(minX-gp,minY-gp,(maxX-minX)+gp*2,(maxY-minY)+gp*2);

  // Plate
  ctx.fillStyle='rgba(0,0,0,0.72)';
  ctx.strokeStyle=sc+'aa'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(c[0][0],c[0][1]);
  for(let i=1;i<4;i++)ctx.lineTo(c[i][0],c[i][1]);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // Inner glow
  ctx.strokeStyle=sc+'44'; ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.moveTo(c[0][0],c[0][1]);
  for(let i=1;i<4;i++)ctx.lineTo(c[i][0],c[i][1]);
  ctx.closePath(); ctx.stroke();

  // Text
  const cx=(c[0][0]+c[2][0])/2, cy=(c[0][1]+c[2][1])/2;
  const fs = Math.max(8, (maxY-minY)*b.fontSize);
  ctx.font='bold '+fs+'px "Share Tech Mono","Courier New",monospace';
  ctx.fillStyle=sc; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.shadowColor=sc; ctx.shadowBlur=fs*0.5; ctx.fillText(b.text,cx,cy); ctx.shadowBlur=0;
}

/* ── Window grid on trapezoid face ── */
function drawGrid(
  ctx: CanvasRenderingContext2D,
  tl:[number,number],tr:[number,number],
  br:[number,number],bl:[number,number],
  c:number,r:number,
) {
  ctx.save();
  ctx.beginPath(); ctx.moveTo(tl[0],tl[1]); ctx.lineTo(tr[0],tr[1]);
  ctx.lineTo(br[0],br[1]); ctx.lineTo(bl[0],bl[1]); ctx.closePath(); ctx.clip();

  for(let i=0;i<=r;i++){
    const t=i/r;
    ctx.strokeStyle='rgba(0,200,255,0.07)'; ctx.lineWidth=0.5;
    ctx.beginPath();
    ctx.moveTo(lerp(tl[0],bl[0],t), lerp(tl[1],bl[1],t));
    ctx.lineTo(lerp(tr[0],br[0],t), lerp(tr[1],br[1],t));
    ctx.stroke();
  }
  for(let i=0;i<=c;i++){
    const t=i/c;
    ctx.strokeStyle='rgba(0,200,255,0.05)'; ctx.lineWidth=0.5;
    ctx.beginPath();
    ctx.moveTo(lerp(tl[0],tr[0],t), lerp(tl[1],tr[1],t));
    ctx.lineTo(lerp(bl[0],br[0],t), lerp(bl[1],br[1],t));
    ctx.stroke();
  }

  // Lit cell fills
  for(let ri=0;ri<r;ri++)for(let ci=0;ci<c;ci++){
    if(Math.random()>0.32)continue;
    const t1=ri/r,t2=(ri+1)/r,s1=ci/c,s2=(ci+1)/c;
    const x1=lerp(lerp(tl[0],bl[0],t1),lerp(tr[0],br[0],t1),s1);
    const y1=lerp(lerp(tl[1],bl[1],t1),lerp(tr[1],br[1],t1),s1);
    const x2=lerp(lerp(tl[0],bl[0],t2),lerp(tr[0],br[0],t2),s2);
    const y2=lerp(lerp(tl[1],bl[1],t2),lerp(tr[1],br[1],t2),s2);
    const cs=['rgba(0,229,255,0.35)','rgba(255,0,128,0.3)','rgba(255,179,0,0.3)','rgba(0,180,220,0.25)'];
    ctx.fillStyle=cs[Math.floor(Math.random()*cs.length)];
    ctx.fillRect(x1+1,y1+1,Math.max(1,x2-x1-2),Math.max(1,y2-y1-2));
  }
  ctx.restore();
}

/* ── Building face ── */
function drawFace(
  ctx: CanvasRenderingContext2D,
  tl:[number,number],tr:[number,number],
  br:[number,number],bl:[number,number],
  c:number,r:number, bills:Billboard[],
) {
  ctx.fillStyle='rgba(5,4,13,0.94)';
  ctx.beginPath();ctx.moveTo(tl[0],tl[1]);ctx.lineTo(tr[0],tr[1]);
  ctx.lineTo(br[0],br[1]);ctx.lineTo(bl[0],bl[1]);ctx.closePath();ctx.fill();

  // Rim light
  const rl = Math.abs(tr[0]-tl[0])*0.12+3;
  const rg=ctx.createLinearGradient(0,tl[1],0,tl[1]+rl);
  rg.addColorStop(0,'rgba(0,220,255,0.13)');rg.addColorStop(1,'transparent');
  ctx.fillStyle=rg;
  ctx.beginPath();ctx.moveTo(tl[0],tl[1]);ctx.lineTo(tr[0],tr[1]);
  ctx.lineTo(tr[0],tr[1]+rl);ctx.lineTo(tl[0],tl[1]+rl);ctx.closePath();ctx.fill();

  drawGrid(ctx,tl,tr,br,bl,c,r);
  for(const bill of bills) drawBillboard(ctx,tl,tr,br,bl,bill);
}

/* ── Pre-render static scene ── */
function renderScene(w: number, h: number): HTMLCanvasElement {
  const off=document.createElement('canvas');off.width=w;off.height=h;
  const ctx=off.getContext('2d')!;
  const vpX=w*VP_X, vpY=h*VP_Y;

  // Sky
  const sg=ctx.createLinearGradient(0,0,0,vpY);
  sg.addColorStop(0,'#030314'); sg.addColorStop(0.4,'#06061c');
  sg.addColorStop(0.7,'#090720'); sg.addColorStop(1,'#0d0820');
  ctx.fillStyle=sg; ctx.fillRect(0,0,w,vpY);

  for(const hx of [0.15,0.3,0.5,0.7,0.85]){
    for(const hy of [0.4,0.65,0.95]){
      const g=ctx.createRadialGradient(w*hx,vpY*hy,0,w*hx,vpY*hy,h*0.22*hy);
      const cs=['rgba(0,140,240,0.025)','rgba(255,0,90,0.022)','rgba(90,0,190,0.018)'];
      g.addColorStop(0,cs[Math.floor(Math.random()*3)]);g.addColorStop(1,'transparent');
      ctx.fillStyle=g;ctx.fillRect(0,0,w,vpY);
    }
  }

  // Road
  ctx.fillStyle='#0b0b1a';
  ctx.beginPath();ctx.moveTo(vpX,vpY);ctx.lineTo(rlx(w,vpX,1),h);ctx.lineTo(rrx(w,vpX,1),h);ctx.closePath();ctx.fill();

  const rd=ctx.createLinearGradient(0,vpY,0,h);
  rd.addColorStop(0,'rgba(0,0,0,0.3)');rd.addColorStop(0.3,'rgba(8,4,16,0.06)');
  rd.addColorStop(0.6,'rgba(10,5,18,0.04)');rd.addColorStop(1,'rgba(12,7,18,0.45)');
  ctx.fillStyle=rd;ctx.fillRect(0,vpY,w,h-vpY);

  // Lane dashes
  ctx.fillStyle='rgba(190,200,220,0.1)';
  for(let i=0;i<32;i++){
    const d1=i*0.031,d2=d1+0.016; if(d2>1)break;
    const y1=sy(h,vpY,d1), y2=sy(h,vpY,d2), lw1=2*d1, lw2=2*d2;
    ctx.beginPath();ctx.moveTo(vpX-lw1/2,y1);ctx.lineTo(vpX+lw1/2,y1);
    ctx.lineTo(vpX+lw2/2,y2);ctx.lineTo(vpX-lw2/2,y2);ctx.closePath();ctx.fill();
  }

  // Crosswalk
  const cd=0.66;
  for(let i=0;i<10;i++){
    const d1=cd-0.012+i*0.0032, d2=cd-0.012+(i+0.75)*0.0032;
    if(d1<0||d1>1)continue;
    ctx.fillStyle='rgba(200,210,230,'+(0.05+i*0.004)+')';
    ctx.beginPath();
    ctx.moveTo(rlx(w,vpX,d1),sy(h,vpY,d1));ctx.lineTo(rrx(w,vpX,d1),sy(h,vpY,d1));
    ctx.lineTo(rrx(w,vpX,Math.min(d2,1)),sy(h,vpY,Math.min(d2,1)));
    ctx.lineTo(rlx(w,vpX,Math.min(d2,1)),sy(h,vpY,Math.min(d2,1)));
    ctx.closePath();ctx.fill();
  }

  // Wet road reflection
  const wet=ctx.createLinearGradient(0,vpY,0,h);
  wet.addColorStop(0.1,'rgba(0,160,230,0.01)');wet.addColorStop(0.45,'rgba(100,0,220,0.018)');
  wet.addColorStop(0.7,'rgba(240,0,110,0.012)');wet.addColorStop(1,'rgba(0,220,255,0.022)');
  ctx.fillStyle=wet;ctx.fillRect(0,vpY,w,h-vpY);

  // Curb
  ctx.strokeStyle='rgba(0,180,230,0.04)';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(0,vpY);ctx.lineTo(rlx(w,vpX,1)-2,h);ctx.stroke();
  ctx.beginPath();ctx.moveTo(w,vpY);ctx.lineTo(rrx(w,vpX,1)+2,h);ctx.stroke();

  // Road edge lines
  ctx.strokeStyle='rgba(140,160,190,0.06)';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(vpX,vpY);ctx.lineTo(rlx(w,vpX,1),h);ctx.stroke();
  ctx.beginPath();ctx.moveTo(vpX,vpY);ctx.lineTo(rrx(w,vpX,1),h);ctx.stroke();

  /* ── Buildings ── */
  const strips=[{dT:0.04,dB:0.16,tR:0.4,cols:4,rows:6},{dT:0.12,dB:0.30,tR:0.5,cols:5,rows:8},{dT:0.25,dB:0.52,tR:0.58,cols:6,rows:10}];

  for(const bs of strips){
    const tY=vpY-vpY*bs.tR;
    const ltl:[number,number]=[0,tY], ltr:[number,number]=[rlx(w,vpX,bs.dT),tY];
    const lbl:[number,number]=[0,sy(h,vpY,bs.dB)], lbr:[number,number]=[rlx(w,vpX,bs.dB),sy(h,vpY,bs.dB)];
    const lb:Billboard[]=[];
    if(bs===strips[0]){
      lb.push({bx:0.08,by:0.12,bw:0.6,bh:0.13,text:'CYBERPUNK',color:'magenta',fontSize:0.8});
      lb.push({bx:0.2,by:0.48,bw:0.5,bh:0.11,text:'TOKYO',color:'cyan',fontSize:0.75});
    }else if(bs===strips[1]){
      lb.push({bx:0.04,by:0.08,bw:0.55,bh:0.09,text:'24H',color:'amber',fontSize:0.85});
      lb.push({bx:0.25,by:0.58,bw:0.5,bh:0.08,text:'NEON',color:'cyan',fontSize:0.7});
    }else{
      lb.push({bx:0.04,by:0.28,bw:0.45,bh:0.1,text:'2048',color:'magenta',fontSize:0.8});
      lb.push({bx:0.06,by:0.62,bw:0.4,bh:0.08,text:'OPEN',color:'amber',fontSize:0.75});
    }
    drawFace(ctx,ltl,ltr,lbr,lbl,bs.cols,bs.rows,lb);
  }

  for(const bs of strips){
    const tY=vpY-vpY*(bs.tR*(0.7+Math.random()*0.55));
    const rtl:[number,number]=[rrx(w,vpX,bs.dT),tY], rtr:[number,number]=[w,tY];
    const rbl:[number,number]=[rrx(w,vpX,bs.dB),sy(h,vpY,bs.dB)], rbr:[number,number]=[w,sy(h,vpY,bs.dB)];
    const rb:Billboard[]=[];
    if(bs===strips[0]){
      rb.push({bx:0.1,by:0.15,bw:0.5,bh:0.12,text:'\u30E9\u30FC\u30E1\u30F3',color:'amber',fontSize:0.7});
      rb.push({bx:0.2,by:0.52,bw:0.45,bh:0.1,text:'DATA',color:'cyan',fontSize:0.75});
    }else if(bs===strips[1]){
      rb.push({bx:0.12,by:0.12,bw:0.5,bh:0.1,text:'GAME',color:'magenta',fontSize:0.8});
      rb.push({bx:0.18,by:0.62,bw:0.5,bh:0.08,text:'404',color:'cyan',fontSize:0.7});
    }else{
      rb.push({bx:0.08,by:0.22,bw:0.45,bh:0.1,text:'\u6771\u4EAC',color:'purple',fontSize:0.75});
      rb.push({bx:0.04,by:0.65,bw:0.4,bh:0.08,text:'NET',color:'cyan',fontSize:0.7});
    }
    drawFace(ctx,rtl,rtr,rbr,rbl,bs.cols,bs.rows,rb);
  }

  // Center dark overlay (board protection)
  const bg=ctx.createRadialGradient(w/2,h*0.44,w*0.05,w/2,h*0.44,w*0.36);
  bg.addColorStop(0,'rgba(0,0,0,0.38)');bg.addColorStop(0.4,'rgba(0,0,0,0.12)');bg.addColorStop(1,'transparent');
  ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);

  return off;
}

/* ── Road clip mask ── */
function roadMask(w:number,h:number): Path2D {
  const vpX=w*VP_X,vpY=h*VP_Y;
  const p=new Path2D();
  p.moveTo(vpX,vpY);p.lineTo(rlx(w,vpX,1),h);p.lineTo(rrx(w,vpX,1),h);p.closePath();
  return p;
}

/* ── React component ── */
export default function NeonCortexBg() {
  const cr=useRef<HTMLCanvasElement>(null);

  useEffect(()=>{
    const c=cr.current; if(!c)return;
    const cx=c.getContext('2d'); if(!cx)return;

    let w=0,h=0;
    let scene:HTMLCanvasElement|null=null;
    let mask:Path2D=new Path2D();
    let id=0,tick=0,glUntil=0;
    let glSlices:Array<{y:number;h:number;ox:number}>=[];

    const trails:Trail[]=[];
    const MT=10;

    function spawn(){
      const d=Math.random()>0.5?1:-1;
      const dp=0.22+Math.random()*0.7;
      const yp=sy(h,h*VP_Y,dp);
      trails.push({y:yp,vx:d*(1+Math.random()*2.8)*(0.3+dp*0.7),
        life:0,maxLife:45+Math.random()*100,length:22+Math.random()*50*(0.35+dp*0.65),
        alpha:0.3+Math.random()*0.5,
        color:d===1?(Math.random()>0.3?'white':'cyan'):(Math.random()>0.2?'red':Math.random()>0.5?'magenta':'white'),
        direction:d,
      });
    }

    function rs(){
      const dpr=0.55;
      w=Math.floor(c!.offsetWidth*dpr);h=Math.floor(c!.offsetHeight*dpr);
      c!.width=w;c!.height=h;
      scene=renderScene(w,h);mask=roadMask(w,h);trails.length=0;
    }

    function f(_t:number){
      id=requestAnimationFrame(f);tick++;

      cx!.clearRect(0,0,w,h);
      if(scene)cx!.drawImage(scene,0,0);

      if(trails.length<MT&&Math.random()<0.06)spawn();

      /* Car trails - clipped to road */
      cx!.save();cx!.clip(mask);
      const vpX=w*VP_X,vpY=h*VP_Y;

      for(let i=trails.length-1;i>=0;i--){
        const t=trails[i];t.life++;
        if(t.life>t.maxLife){trails.splice(i,1);continue;}

        const p=t.life/t.maxLife;
        const fad=p<0.12?p/0.12:p>0.88?(1-p)/0.12:1;
        const a=t.alpha*fad;
        const d=depth(t.y,h,vpY);
        const xR=(vpX*2)*d*ROAD_W*1.6;
        const mnX=vpX-xR,mxX=vpX+xR;
        const tX=t.direction===1?mnX+p*(mxX-mnX):mxX-p*(mxX-mnX);

        const tc=t.color==='white'?'rgba(240,240,255,':t.color==='red'?'rgba(255,30,30,':t.color==='cyan'?'rgba(0,229,255,':'rgba(255,0,128,';

        const tG=cx!.createRadialGradient(tX,t.y,0,tX,t.y,5+d*4);
        tG.addColorStop(0,tc+a+')');tG.addColorStop(0.5,tc+(a*0.25)+')');tG.addColorStop(1,'transparent');
        cx!.fillStyle=tG;cx!.fillRect(tX-10,t.y-6,20,12);

        const tl=t.length;
        cx!.strokeStyle=tc+(a*0.55)+')';cx!.lineWidth=0.7+d*1.1;
        cx!.beginPath();cx!.moveTo(tX,t.y);
        cx!.lineTo(tX-t.direction*tl,t.y+(Math.random()-0.5)*1.5);cx!.stroke();

        cx!.strokeStyle=t.color==='white'?'rgba(255,255,255,'+(a*0.65)+')':tc+(a*0.75)+')';
        cx!.lineWidth=0.3+d*0.5;
        cx!.beginPath();cx!.moveTo(tX,t.y);cx!.lineTo(tX-t.direction*tl*0.6,t.y);cx!.stroke();
      }
      cx!.restore();

      // Fog
      const ft=tick*0.007;
      cx!.globalCompositeOperation='lighter';
      for(let fi=0;fi<3;fi++){
        const fy=vpY*0.3+fi*vpY*0.2;
        const fa=0.007+0.005*Math.sin(ft+fi*2.2);
        const fg=cx!.createLinearGradient(0,fy-8,0,fy+16);
        const faa=['rgba(0,229,255,','rgba(255,0,128,','rgba(112,0,255,'];
        fg.addColorStop(0,'transparent');fg.addColorStop(0.5,faa[fi]+fa+')');fg.addColorStop(1,'transparent');
        cx!.fillStyle=fg;cx!.fillRect(0,fy-8,w,24);
      }
      cx!.globalCompositeOperation='source-over';

      // Scanlines
      cx!.fillStyle='rgba(0,0,0,0.02)';
      for(let y=0;y<h;y+=3)cx!.fillRect(0,y,w,1);

      // Glitch
      if(tick>glUntil&&Math.random()<0.006){
        glUntil=tick+3+Math.floor(Math.random()*8);
        glSlices=[];
        for(let i=0;i<2+Math.floor(Math.random()*3);i++){
          glSlices.push({y:Math.floor(Math.random()*h*0.55),h:2+Math.floor(Math.random()*12),ox:(Math.random()-0.5)*18});
        }
      }
      if(tick<=glUntil)for(const s of glSlices){
        cx!.fillStyle='rgba(0,229,255,'+(0.04+Math.random()*0.03)+')';cx!.fillRect(s.ox,s.y,Math.abs(s.ox)+2,s.h);
        cx!.fillStyle='rgba(255,0,128,'+(0.02+Math.random()*0.025)+')';cx!.fillRect(w+s.ox,s.y,Math.abs(s.ox)+2,s.h);
      }
    }

    rs();window.addEventListener('resize',rs);
    id=requestAnimationFrame(f);
    return()=>{cancelAnimationFrame(id);window.removeEventListener('resize',rs);};
  },[]);

  return <canvas ref={cr} style={{position:'absolute',inset:0,width:'100%',height:'100%',display:'block'}}/>;
}
