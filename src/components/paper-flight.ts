type Point = { x: number; y: number };
type Sample = Point & { distance: number };
type Puff = Point & { born: number; size: number; rotation: number; drift: number };
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, n: number) => { const t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t); };

// Sample each curve once. Equal distances along this table avoid the sudden
// speed changes caused by unevenly spaced control points.
function sampleLoop(points: number[][]): Sample[] {
  const samples: Sample[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[(i - 1 + points.length) % points.length], b = points[i];
    const c = points[(i + 1) % points.length], d = points[(i + 2) % points.length];
    for (let step = 0; step < 48; step++) {
      const t = step / 48, t2 = t * t, t3 = t2 * t;
      const axis = (j: number) => .5 * (2*b[j] + (-a[j]+c[j])*t + (2*a[j]-5*b[j]+4*c[j]-d[j])*t2 + (-a[j]+3*b[j]-3*c[j]+d[j])*t3);
      const x = axis(0), y = axis(1), previous = samples.at(-1);
      samples.push({ x, y, distance: previous ? previous.distance + Math.hypot(x - previous.x, y - previous.y) : 0 });
    }
  }
  const first = samples[0], last = samples.at(-1)!;
  samples.push({ ...first, distance: last.distance + Math.hypot(first.x-last.x, first.y-last.y) });
  return samples;
}

function position(samples: Sample[], progress: number): Point {
  const distance = clamp(progress) * samples.at(-1)!.distance;
  let lo = 0, hi = samples.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (samples[mid].distance < distance) lo = mid; else hi = mid; }
  const a = samples[lo], b = samples[hi];
  const t = (distance-a.distance) / (b.distance-a.distance || 1);
  return { x: mix(a.x,b.x,t), y: mix(a.y,b.y,t) };
}

function cloudSprite() {
  const canvas = document.createElement("canvas");
  canvas.width = 96; canvas.height = 80;
  const context = canvas.getContext("2d")!;
  // Soft, overlapping lobes are baked once; no per-frame CSS/SVG blur filters.
  for (const [x,y,r] of [[27,46,20],[43,31,24],[64,41,22],[46,50,24]]) {
    const gradient = context.createRadialGradient(x-3,y-4,3,x,y,r);
    gradient.addColorStop(0,"rgba(255,252,235,.9)");
    gradient.addColorStop(.55,"rgba(255,248,226,.85)");
    gradient.addColorStop(.83,"rgba(245,228,194,.5)");
    gradient.addColorStop(1,"rgba(245,228,194,0)");
    context.fillStyle = gradient;
    context.fillRect(x-r,y-r,r*2,r*2);
  }
  return canvas;
}

function polygon(context: CanvasRenderingContext2D, points: number[][], fill: string | CanvasGradient) {
  context.beginPath();
  points.forEach(([x,y],i) => i ? context.lineTo(x,y) : context.moveTo(x,y));
  context.closePath(); context.fillStyle = fill; context.fill();
}

function drawPlane(context: CanvasRenderingContext2D, p: Point, angle: number, width: number, bank: number, folded: number, alpha: number) {
  context.save();
  context.translate(p.x,p.y); context.rotate(angle); context.scale(width,width*.65);
  context.globalAlpha = alpha;
  const ribbon = [[-.5,-.12],[.5,-.12],[.42,.05],[-.5,.1]];
  const upper = [[-.5,-.48],[.56,0],[-.2,0],[-.5,-.48]];
  const lower = [[-.5,.48],[.56,0],[-.2,0],[-.5,.48]];
  const shape = (target: number[][], lowerSide = false) => target.map(([x,y],i) => [mix(ribbon[i][0],x,folded), mix(ribbon[i][1] + (lowerSide ? .12 : 0),y,folded)]);
  const upperShade = context.createLinearGradient(-.25,-.5,.1,.1);
  upperShade.addColorStop(0,"#fff1bc"); upperShade.addColorStop(1,"#dfb153");
  const lowerShade = context.createLinearGradient(0,0,-.25,.5);
  lowerShade.addColorStop(0,"#c48d37"); lowerShade.addColorStop(1,"#f0cf7c");
  context.scale(1,bank);
  polygon(context,shape(upper),upperShade);
  polygon(context,shape(lower,true),lowerShade);
  context.globalAlpha = alpha * folded;
  polygon(context,[[-.2,0],[.56,0],[-.05,.18]],"#a66c2d");
  context.lineWidth = .009;
  context.strokeStyle = "#fff3c7";
  context.beginPath(); context.moveTo(-.2,0); context.lineTo(.56,0); context.stroke();
  context.restore();
}

export function animatePaperFlight(canvases: HTMLCanvasElement[], folds: (HTMLImageElement | null)[], rect: DOMRect, finish: () => void) {
  const w = window.innerWidth, h = window.innerHeight, mobile = w <= 600;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const contexts = canvases.map(canvas => {
    canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr);
    const context = canvas.getContext("2d")!;
    context.scale(dpr,dpr);
    return context;
  });
  const sprite = cloudSprite();
  const planes = [[.485,.318,.72],[.45,.486,.57],[.418,.653,.44]].map(([fx,fy,fw],i) => {
    const x = rect.left + rect.width*fx, y = rect.top + rect.height*fy;
    const routes = [
      [[x,y],[x+w*.07,y-18],[w*.77,h*.14],[w*.39,h*.2],[w*.12,h*.38],[w*.34,h*.52],[x-w*.24,y+65],[x-w*.08,y+8]],
      [[x,y],[x+w*.07,y-12],[w*.91,h*.5],[w*.63,h*.76],[w*.17,h*.63],[w*.14,h*.34],[x-w*.28,y-45],[x-w*.08,y+8]],
      [[x,y],[x+w*.07,y-12],[w*.73,h*.28],[w*.34,h*.4],[w*.38,h*.68],[w*.73,h*.76],[w*.9,h*.47],[x-w*.12,y+12]],
    ];
    return { samples: sampleLoop(routes[i]), startWidth: rect.width*fw, delay: i*110, duration: 3150+i*90, puffs: [] as Puff[], lastPuff: -1, puffCount: 0 };
  });
  const start = performance.now();
  let frame = 0;
  function draw(now: number) {
    const elapsed = now - start;
    contexts.forEach(context => context.clearRect(0,0,w,h));
    planes.forEach((plane,i) => {
      const t = clamp((elapsed-plane.delay)/plane.duration);
      // Smooth acceleration at launch/landing, uninterrupted travel in between.
      const distance = t < .12 ? t*t/(.24*.88) : t > .88 ? 1-(1-t)*(1-t)/(.24*.88) : (t-.06)/.88;
      const p = position(plane.samples,distance);
      const before = position(plane.samples,Math.max(0,distance-.003));
      const after = position(plane.samples,Math.min(1,distance+.003));
      const angle = Math.atan2(after.y-before.y,after.x-before.x);
      const away = smooth(0,.12,t)*(1-smooth(.86,1,t));
      const depth = (i === 0 ? .75 : 1) + Math.sin(t*Math.PI*2-i*.8)*.22;
      const width = mix(plane.startWidth,(mobile ? 67 : 104)*depth,away);
      const opacity = smooth(0,.055,t)*(1-smooth(.94,1,t));
      const context = contexts[i === 0 ? 0 : 1];
      if (folds[i]) folds[i]!.style.opacity = String(1-opacity);

      // Short-lived cloud sprites keep the drawing work bounded. Flight position
      // is based on elapsed time, so it never slows down with the frame rate.
      if (t > .09 && t < .84 && elapsed-plane.lastPuff > 32) {
        plane.lastPuff = elapsed;
        const n = plane.puffCount++;
        plane.puffs.push({ x:p.x-Math.cos(angle)*width*.38, y:p.y-Math.sin(angle)*width*.38, born:elapsed, size:(mobile?14:21)*depth*(.85+(n%3)*.13), rotation:Math.sin(n*2.4)*.3, drift:Math.sin(n*1.7)*10 });
      }
      plane.puffs = plane.puffs.filter(puff => elapsed-puff.born < 540);
      plane.puffs.forEach(puff => {
        const age = (elapsed-puff.born)/540;
        const size = puff.size*(.65+age*.95);
        context.save();
        context.globalAlpha = (1-Math.exp(-age*12))*Math.pow(1-age,1.7)*.85;
        context.translate(puff.x+puff.drift*age,puff.y-age*14);
        context.rotate(puff.rotation);
        context.drawImage(sprite,-size,-size*.83,size*2,size*1.66);
        context.restore();
      });
      if (t > 0 && t < 1) drawPlane(context,p,angle,width,1-Math.sin(t*Math.PI*5+i)*.22*away,away,opacity);
    });
    if (elapsed < 3630) frame = requestAnimationFrame(draw);
    else finish();
  }
  frame = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(frame);
}
