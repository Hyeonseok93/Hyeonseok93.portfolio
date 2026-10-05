document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
  document.querySelectorAll('.tab').forEach(x=>x.setAttribute('aria-selected',x===t));
  document.querySelectorAll('.panel').forEach(p=>p.hidden=p.id!==t.dataset.p);
});

(() => {
  const rx = document.querySelector('.rx');
  if (!rx) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const panel = document.getElementById('rs');
  const inView = el => { const r = el.getBoundingClientRect(); return !panel.hidden && r.bottom > 0 && r.top < innerHeight; };

  /* ---------- tiny render helpers ---------- */
  const row = (bytes, opt = {}) => `<div class="hx" style="--r:${opt.r || 0}ms">${bytes.map((b, i) => {
    if (Array.isArray(b)) return `<b class="sw" style="--s:${b[2] || 900}ms"><i>${b[0]}</i><i>${b[1]}</i></b>`;
    const c = (opt.cls || {})[i] || (b === '?' ? 'mk' : '');
    return `<b class="${c}">${b}</b>`;
  }).join('')}</div>`;
  const log = (html, r = 0) => `<div class="lg" style="--r:${r}ms">${html}</div>`;
  const lab = t => `<span class="st-lab">${t}</span>`;
  const swt = (a, b, s = 900) => `<span class="swt" style="--s:${s}ms"><i>${a}</i><i>${b}</i></span>`;
  const scores = (toks, vals, base = 300) => `<div class="hx hx--score">${toks.map((b, i) => {
    const hot = vals[i] >= 5;
    return `<span><b class="${hot ? 'hot' : ''}">${b}</b><em class="${hot ? 'hot' : ''}" style="--s:${base + i * 160}ms">${vals[i]}</em></span>`;
  }).join('')}</div>`;

  const gpkt = groups => `<div class="gp">${groups.map(([b, t]) => `<div><code>${b.split(' ').map(x => `<b>${x}</b>`).join('')}</code><small>${t}</small></div>`).join('')}</div>`;
  const glog = (code, gloss, r = 0, bad = false) => `<div class="gl" style="--r:${r}ms"><code>${code}</code><small class="${bad ? 'bad' : ''}">${gloss}</small></div>`;
  const kase = (id, pk, lg, r = 0, bad = false) => `<div class="cs ${bad ? 'cs--b' : ''}" style="--r:${r}ms"><span class="cs__id">${id}</span><code>${pk}</code><code>${lg}</code></div>`;
  const gauge = (name, v, s) => `<div class="gauge ${v >= 5 ? 'hi' : ''}"><span>${name}</span><i style="--w:${Math.min(100, v / 15 * 100).toFixed(0)}%;--s:${s}ms"></i><b>${v}</b></div>`;
  const ptable = rows => `<table class="pt" style="--r:150ms"><thead><tr><th></th><th class="lo">온도 낮음</th><th class="hi">온도 높음</th></tr></thead><tbody>${rows.map(([b, lo, hi], i) =>
    `<tr><td>${b}</td>${[['lo', lo], ['hi', hi]].map(([c, v]) => `<td class="${c} ${v ? '' : 'zero'}"><div class="bar"><i style="--v:${v * 1.1};--s:${300 + i * 120}ms"></i><span>${v ? v + '%' : '–'}</span></div></td>`).join('')}</tr>`).join('')}</tbody></table>`
    + `<p class="pt-note" style="--r:900ms">낮음: A2가 72%로 거의 독점 · 높음: 다섯 후보가 고르게 경쟁</p>`;

  /* ---------- step data (values from the original detect/fuzz pages) ---------- */
  const C = '공통';
  const FLOWS = {
    detect: [
      { tag: C, title: '정상 데이터를 모은다', desc: '공장에서 매일 오가는 정상 통신(패킷)과 장비가 남기는 기록(로그)을 모읍니다. 공격 데이터는 필요 없습니다.',
        html: () => lab('Packet · 통신 한 건') + gpkt([['01','장비 번호'],['03','명령: 읽기'],['A2 7F','주소'],['00 1C','개수']])
          + lab('Log · 장비 기록') + glog('Read holding ok', '레지스터 읽기 · 성공', 300) + glog('Write coil ok', '코일 쓰기 · 성공', 420) },
      { tag: C, title: '빈칸을 맞히며 문법을 익힌다', desc: '일부를 가리고 원래 값을 맞히게 하면, 모델이 "이 자리엔 보통 이 값이 온다"는 규칙을 스스로 배웁니다.',
        html: () => lab('Packet') + row(['01','03',['?','A2'],'7F','00','1C']) + lab('Log') + log(`Read ${swt('?', 'holding', 1100)} ok`, 200) },
      { tag: 'Detect', title: '검사할 데이터가 들어온다', desc: '두 건이 들어왔습니다. 겉보기엔 비슷하지만, B는 세 번째 바이트와 로그 결과가 다릅니다.',
        html: () => kase('A', '01 03 A2 7F 00 1C', 'Read holding ok', 0) + kase('B', '01 03 <em>FF</em> 7F 00 1C', 'Read holding <em>err</em>', 220, true) },
      { tag: 'Detect', title: 'B를 한 칸씩 검사한다', desc: '한 칸씩 가려 보며, 배운 규칙으로는 나오기 어려운 값일수록 높은 점수를 줍니다. FF와 err만 점수가 튑니다.',
        html: () => lab('B · Packet') + scores(['01','03','FF','7F','00','1C'], [0.1, 0.2, 12.4, 0.1, 1.8, 0.3])
          + lab('B · Log') + scores(['Read','holding','err'], [0.2, 0.4, 9.7], 1300) },
      { tag: 'Detect', title: '사례마다 점수 한 쌍', desc: '자리 점수를 모아 사례마다 패킷 점수 하나, 로그 점수 하나를 만듭니다. 두 점수가 함께 낮으면 정상, 높으면 이상입니다.',
        html: () => `<div class="cs2">
          <div class="a" style="--r:0ms"><div class="cs2__hd"><span>A</span>정상처럼 보이는 건</div>
            <span class="cs2__sub">이상 점수</span>${gauge('패킷', 2.1, 300)}${gauge('로그', 0.8, 450)}<span class="verdict" style="--s:800ms">Q1 · 둘 다 정상</span></div>
          <div class="b" style="--r:250ms"><div class="cs2__hd"><span>B</span>수상한 건</div>
            <span class="cs2__sub">이상 점수</span>${gauge('패킷', 14.9, 650)}${gauge('로그', 10.3, 800)}<span class="verdict bad" style="--s:1150ms">Q4 · 둘 다 이상</span></div></div>` },
      { tag: 'Detect', title: '사분면에 올려 해석한다', desc: '로그 점수를 가로, 패킷 점수를 세로로 올리면 이상 여부와 어느 쪽이 문제인지가 칸으로 드러납니다. A는 Q1, B는 Q4입니다.',
        html: () => `<div class="st-mq"><span>Q1</span><span>Q2</span><span>Q3</span><span>Q4</span>
          <i style="left:18%;top:24%;background:#79c0ff;--s:300ms"></i><em class="st-mq__l" style="left:18%;top:24%;--s:300ms">A</em>
          <i style="left:80%;top:76%;background:var(--d);--s:900ms"></i><em class="st-mq__l" style="left:80%;top:76%;--s:900ms">B</em></div>` },
    ],
    fuzz: [
      { tag: C, title: '정상 패킷을 모은다', desc: '여기서는 패킷만 씁니다. 평소 오가는 정상 통신을 쭉 모읍니다. 공격 패킷은 필요 없습니다.',
        html: () => lab('Packet') + [['01','03','A2','7F','00','1C'],['01','03','B1','2A','00','08'],['01','06','00','10','FF','3E'],['01','03','0C','55','00','0A'],['01','04','00','01','00','02']].map((r, i) => row(r, { r: i * 110 })).join('') },
      { tag: C, title: '빈칸을 맞히며 문법을 익힌다', desc: 'Detect와 같은 방식입니다. 일부를 가리고 평소 값을 맞히며 패킷의 규칙을 배웁니다.',
        html: () => lab('Packet') + row(['01','03',['?','A2'],'7F','00','1C']) + row(['01',['?','06',1300],'00','10',['?','FF',1500],'3E'], { r: 300 }) },
      { tag: 'Fuzz', title: '빈 패킷을 모델에 넘긴다', desc: '이번엔 정답을 맞히는 게 아니라, 비어 있는 패킷을 주고 학습한 규칙으로 새로 채우게 합니다.',
        html: () => lab('generate') + [0, 1, 2].map(i => row(['?','?','?','?','?','?'], { r: i * 140 })).join('') },
      { tag: 'Fuzz', title: '문맥을 보며 한 칸씩 채운다', desc: '이미 채운 칸을 문맥으로 삼아 다음 칸을 이어서 채웁니다. 그래서 형식이 무너지지 않습니다.',
        html: () => lab('Packet') + row(['01','03','A3','7F','00','1C'].map((b, i) => ['?', b, 400 + i * 380])) },
      { tag: 'Fuzz', title: '온도로 탐색 폭을 조절한다', desc: '같은 빈칸이라도 온도가 낮으면 확률이 높은 A2에 몰리고, 높으면 FF·7E 같은 낯선 후보에도 기회가 갑니다.',
        html: () => lab('빈칸 후보와 뽑힐 확률') + ptable([['A2', 72, 24], ['A3', 18, 16], ['B0', 7, 22], ['FF', 0, 19], ['7E', 0, 11]]) },
      { tag: 'Fuzz', title: '최종 퍼징 입력', desc: '형식 검사를 통과하면서도 평소와 다른 값을 담은 입력이 완성됩니다. 이걸 장비에 보내 약점을 찾습니다.',
        html: () => lab('Packet') + row(['01','03','A3','7F','00','1C'], { cls: { 2: 'ok' } })
          + `<span class="st-check" style="--r:400ms">✓ 형식 검사 통과</span><span class="st-check" style="--r:700ms">✓ 평소와 다른 값(A3)</span>` },
    ],
  };

  /* ---------- steps: all visible, each one animates once when scrolled to ---------- */
  const lists = [...document.querySelectorAll('[data-steps]')];
  lists.forEach(ol => {
    ol.innerHTML = FLOWS[ol.dataset.steps].map((st, k) => `
      <li class="step ${st.tag === C ? 'step--common' : ''}">
        <span class="step__n">${k + 1}</span>
        <div><div class="step__hd"><span class="step__tag">${st.tag}</span><b class="step__title">${st.title}</b></div>
          <p class="step__desc">${st.desc}</p>
          <div class="step__vis">${st.html()}</div></div>
      </li>`).join('');
  });
  const stepEls = [...document.querySelectorAll('.step')];
  if (reduce) stepEls.forEach(el => el.classList.add('in'));
  let queue = [], qBusy = false;
  const drain = () => {
    if (!queue.length) { qBusy = false; return; }
    qBusy = true; queue.shift().classList.add('in'); setTimeout(drain, 180);
  };
  const stepIO = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting || panel.hidden) return;
    stepIO.unobserve(e.target); queue.push(e.target); if (!qBusy) drain();
  }), { threshold: 0.25, rootMargin: '0px 0px -8% 0px' });
  stepEls.forEach(el => stepIO.observe(el));

  /* ---------- result: quadrant dots stamp in one by one ---------- */
  const quad = rx.querySelector('[data-quad]');
  // each cell: Q label sits top-left, dots fill the lower part (plot %, x then y)
  const GROUPS = [
    { cls: '',      pts: [[8,30],[17,40],[26,27],[34,37],[42,29],[13,45],[30,46],[40,44]] },  // Q1 normal
    { cls: 'qd--a', pts: [[60,31],[70,41],[80,28],[89,38],[75,46]] },                         // Q2 FDIA
    { cls: 'qd--o', pts: [[12,80],[27,90],[38,77]] },                                         // Q3 example
    { cls: 'qd--o', pts: [[62,86],[78,78],[90,91]] },                                         // Q4 example
  ];
  quad.insertAdjacentHTML('beforeend', GROUPS.map(g => g.pts.map(([x, y]) => `<i class="qd ${g.cls}" style="--x:${x}%;--y:${y}%"></i>`).join('')).join(''));
  const qdots = [...quad.querySelectorAll('.qd')];
  let qT = [];
  const runQuad = () => {
    qT.forEach(clearTimeout); qT = [];
    quad.classList.remove('fade'); qdots.forEach(d => d.classList.remove('on'));
    if (reduce) { qdots.forEach(d => d.classList.add('on')); return; }
    let t = 300, k = 0;
    GROUPS.forEach((g, gi) => {
      if (gi) t += 500;
      g.pts.forEach(() => { const d = qdots[k++]; qT.push(setTimeout(() => d.classList.add('on'), t)); t += gi === 0 ? 160 : 300; });
    });
    qT.push(setTimeout(() => quad.classList.add('fade'), t + 2600));
    qT.push(setTimeout(() => quad._live && runQuad(), t + 3400));
  };

  /* ---------- result: draw 5 values at low and high temperature, side by side ---------- */
  const temp = rx.querySelector('[data-draw]');
  const cols = [...temp.querySelectorAll('[data-draws]')].map(el => {
    el.innerHTML = el.dataset.draws.split(',').map(v => `<i>${v}</i>`).join('');
    return [...el.children];
  });
  const slots = [...temp.querySelectorAll('.draw__slot')];
  let tT = [];
  const runTemp = () => {
    tT.forEach(clearTimeout); tT = [];
    temp.classList.remove('done', 'fade'); cols.flat().forEach(c => c.classList.remove('on'));
    slots.forEach(s => s.textContent = '?');
    if (reduce) { cols.flat().forEach(c => c.classList.add('on')); temp.classList.add('done'); return; }
    let t = 500;
    for (let k = 0; k < 5; k++) {
      cols.forEach((col, ci) => { tT.push(setTimeout(() => { col[k].classList.add('on'); if (ci === 1) slots[1].textContent = col[k].textContent; }, t)); t += 280; });
      t += 200;
    }
    tT.push(setTimeout(() => temp.classList.add('done'), t));
    tT.push(setTimeout(() => temp.classList.add('fade'), t + 3200));
    tT.push(setTimeout(() => temp._live && runTemp(), t + 3800));
  };

  /* ---------- core packet: blanks are predicted one by one ---------- */
  const pkt = rx.querySelector('[data-pkt]');
  const BYTES = ['00','01','00','00','00','06','01','03','A2','7F','00','1C'];   // Modbus/TCP read request
  const MASKS = [1, 6, 8, 11];
  pkt.innerHTML = BYTES.map((b, i) => `<b class="${MASKS.includes(i) ? 'm' : ''}">${MASKS.includes(i) ? '??' : b}</b>`).join('');
  const pcells = [...pkt.children];
  let pT = [];
  const runPkt = () => {
    pT.forEach(clearTimeout); pT = [];
    MASKS.forEach(i => { pcells[i].textContent = '??'; pcells[i].classList.remove('f', 'pop'); });
    const fill = i => { pcells[i].textContent = BYTES[i]; pcells[i].classList.add('f', 'pop'); };
    if (reduce) { MASKS.forEach(fill); return; }
    let t = 700;
    MASKS.forEach(i => { pT.push(setTimeout(() => fill(i), t)); t += 650; });
    pT.push(setTimeout(() => pkt._live && runPkt(), t + 2200));
  };

  /* ---------- start/stop with the tab and viewport ---------- */
  const toggle = (el, on) => {
    if (el === pkt) { if (on && !pkt._live) { pkt._live = true; runPkt(); } else if (!on) { pkt._live = false; pT.forEach(clearTimeout); } return; }
    if (el === quad) { if (on && !quad._live) { quad._live = true; runQuad(); } else if (!on) { quad._live = false; qT.forEach(clearTimeout); } }
    else if (el === temp) { if (on && !temp._live) { temp._live = true; runTemp(); } else if (!on) { temp._live = false; tT.forEach(clearTimeout); } }
  };
  const targets = [pkt, quad, temp];
  const io = new IntersectionObserver(es => es.forEach(e => toggle(e.target, e.isIntersecting && !panel.hidden)), { threshold: 0.3 });
  targets.forEach(el => io.observe(el));
  const sync = () => {
    rx.classList.toggle('is-live', !panel.hidden);
    targets.forEach(el => toggle(el, inView(el)));
    if (!panel.hidden) stepEls.forEach(el => { if (!el.classList.contains('in')) { stepIO.unobserve(el); stepIO.observe(el); } });
  };
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => setTimeout(sync, 30)));
  rx.querySelectorAll('.rx-fork__ends a').forEach(a => a.addEventListener('click', e => {
    e.preventDefault(); document.querySelector(a.getAttribute('href')).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  sync();
})();
