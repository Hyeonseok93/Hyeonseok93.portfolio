document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
  document.querySelectorAll('.tab').forEach(x=>x.setAttribute('aria-selected',x===t));
  document.querySelectorAll('.panel').forEach(p=>p.hidden=p.id!==t.dataset.p);
});

(() => {
  const rx = document.querySelector('.rx');
  if (!rx) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const panel = document.getElementById('rs');

  /* ---------- tiny render helpers ---------- */
  const row = (bytes, opt = {}) => `<div class="hx ${opt.wrap ? 'hx--wrap' : ''} ${opt.long ? 'hx--long' : ''}" style="--r:${opt.r || 0}ms">${bytes.map((b, i) => {
    if (Array.isArray(b)) return `<b class="sw" style="--s:${b[2] || 900}ms;min-width:calc(${Math.max(b[0].length, b[1].length)}ch + 12px)"><i>${b[0]}</i><i>${b[1]}</i></b>`;
    const c = (opt.cls || {})[i] || (b === '?' ? 'mk' : '');
    return `<b class="${c}">${b}</b>`;
  }).join('')}</div>`;
  const lab = t => `<span class="st-lab">${t}</span>`;
  // hot lists the positions that do not fit what the model learned (outlined red); long = full-width packet
  const scores = (toks, hot, base = 300, long = false) => `<div class="hx hx--score ${long ? 'hx--long' : ''}">${toks.map((b, i) => { const h = hot.includes(i);
    return `<span><b class="${h ? 'hot' : ''}" style="--s:${base + i * 160 - 150}ms">${b}</b></span>`; }).join('')}</div>`;

  // one packet + its log line, each position marked normal (·) or 이상
  const pair = (label, pkt, pHot, lg, lHot, r, bad = false) => `<div class="pair ${bad ? 'pair--b' : ''}" style="--r:${r}ms"><b>${label}<small>패킷 · 로그</small></b>
    ${scores(pkt, pHot, r + 300, true)}${scores(lg, lHot, r + 300 + pkt.length * 160)}</div>`;
  // schematic quadrant: Q1 TL · Q2 TR · Q3 BL · Q4 BR, clusters only
  const plot = groups => `<div class="mq"><span class="mq__y">↓ 패킷 이상 점수</span><div class="st-mq">
    <span>Q1<small>정상</small></span><span>Q2<small>로그만 이상</small></span><span>Q3<small>패킷만 이상</small></span><span>Q4<small>둘 다 이상</small></span>
    ${groups.map(([cls, pts], g) => pts.map(([x, y], i) => `<i class="${cls}" style="left:${x}%;top:${y}%;--s:${300 + g * 450 + i * 60}ms"></i>`).join('')).join('')}</div>
    <span class="mq__x">로그 이상 점수 →</span></div>`;
  // fill order: the number under each byte is when it gets filled (same number = filled together)
  const ORD_BYTES = ['01', '03', 'A2', '7F', '00', '1C'];
  const order = (name, note, ord, r) => `<div class="ord" style="--r:${r}ms"><div class="ord__hd"><b>${name}</b><span>${note}</span></div>
    <div class="hx hx--score">${ORD_BYTES.map((b, i) => { const s = r + 400 + (ord[i] - 1) * 300;
      return `<span><b class="sw" style="--s:${s}ms"><i>??</i><i>${b}</i></b><em style="--s:${s}ms">${ord[i]}</em></span>`; }).join('')}</div></div>`;
  // one fuzzing direction: example packet and what it tests
  const dir = (cls, title, bytes, hot, note, r) => `<div class="dir dir--${cls}" style="--r:${r}ms"><b>${title}</b>
    ${row(bytes, { cls: Object.fromEntries(hot.map(i => [i, cls === 'lo' ? 'ok' : 'hot'])) })}<small>${note}</small></div>`;
  // full Modbus/TCP requests (header + body) the model fills in
  const GEN = ['00 01 00 00 00 06 01 03 A2 7F 00 1C', '00 02 00 00 00 06 01 06 00 10 FF 3E', '00 03 00 00 00 06 01 04 00 01 00 02', '00 04 00 00 00 06 01 03 0C 55 00 0A'];
  const NORMAL_PKT = ['00', '01', '00', '00', '00', '06', '01', '03', 'A2', '7F', '00', '1C'];

  /* ---------- step data ---------- */
  const FLOWS = {
    detect: [
      { title: '로그도 함께 학습', desc: 'Detect는 패킷뿐 아니라 장비 로그도 같은 방식으로 학습합니다. 로그의 단어를 가리고 원래 단어를 맞히며 로그의 문법을 익힙니다.',
        html: () => lab('장비 로그 · 가려진 단어 예측') + [
          ['Read', ['?', 'holding'], 'register', 'ok'],
          ['Write', 'single', ['?', 'coil'], 'ok'],
          [['?', 'Read'], 'input', 'register', 'ok'],
          ['Write', 'holding', 'register', ['?', 'ok']],
        ].map((toks, k) => row(toks.map(t => Array.isArray(t) ? [...t, 700 + k * 450] : t), { r: k * 120 })).join('') },
      { title: '평소와 다른 곳 찾기', desc: '검사할 데이터를 한 칸씩 가려 가며 원래 값을 예측합니다. 예측과 크게 다른 칸일수록 이상 점수가 높아집니다.',
        html: () => pair('평소 통신', NORMAL_PKT, [], ['Read', 'holding', 'register', 'ok'], [], 0)
          + pair('검사 대상', NORMAL_PKT.map((b, i) => i === 8 ? 'FF' : b), [8], ['Read', 'holding', 'register', 'err'], [3], 400, true) },
      { title: '패킷과 로그를 함께 판단', desc: '패킷 점수와 로그 점수를 함께 보면, 이상 여부뿐 아니라 어느 쪽에 문제가 있는지까지 알 수 있습니다.',
        html: () => `<div class="qg" style="--r:0ms"><span></span><small>로그 정상</small><small>로그 이상</small>
          <small class="qg__r">패킷<br>정상</small>
          <div class="qg1"><b>Q1</b><span>정상</span><small>패킷과 로그 모두 평소와 같음</small></div>
          <div class="qg2"><b>Q2</b><span>로그만 이상</span><small>앱·제어 로직 문제</small></div>
          <small class="qg__r">패킷<br>이상</small>
          <div class="qg3"><b>Q3</b><span>패킷만 이상</span><small>네트워크 문제</small></div>
          <div class="qg4"><b>Q4</b><span>둘 다 이상</span><small>즉시 대응</small></div></div>` },
      { title: '한쪽만 봐서는 놓치는 이상까지 탐지', desc: '패킷이나 로그 한쪽만 보면 놓칠 수 있는 이상을, 두 쪽을 함께 봐서 잡아냅니다. 정상 데이터로 스스로 학습하기 때문에 사람이 탐지 규칙을 직접 정할 필요도 없습니다.',
        html: () => plot([['n', [[10, 40], [18, 46], [26, 38], [14, 47], [32, 44], [22, 42], [38, 39], [30, 47]]],
            ['x', [[64, 40], [72, 45], [80, 38], [76, 47], [88, 42], [68, 46]]], ['a', [[66, 86], [76, 92], [86, 86]]]]) },
    ],
    fuzz: [
      { title: '빈칸을 채워 새 패킷 생성', desc: '학습을 마친 모델에 비어 있는 패킷을 주면, 익힌 문법대로 칸을 채워 새 입력을 만듭니다.',
        html: () => lab('빈 패킷 → 생성된 패킷') + GEN.map((p, k) => row(p.split(' ').map((b, i) => ['?', b, 500 + k * 450 + i * 40]), { r: k * 120, long: true })).join('')
          + `<p class="st-note" style="--r:2400ms">헤더부터 명령·주소까지, 한 번에 수많은 입력을 만들어 장비에 보냅니다</p>` },
      { title: '채우는 순서 선택', desc: '한 번에 모두 채우면 빠르고, 앞에서 채운 값을 보며 한 칸씩 채우면 형식이 더 정확해집니다.',
        html: () => order('한 번에', '가장 빠름', [1, 1, 1, 1, 1, 1], 0)
          + order('왼쪽부터 한 칸씩', '형식이 정확함', [1, 2, 3, 4, 5, 6], 250)
          + order('양 끝에서 가운데로', '두 방식의 절충', [1, 3, 5, 6, 4, 2], 500) },
      { title: '온도로 퍼징 방향 조절', desc: '온도가 낮으면 문법을 지키면서 값만 바꾸고, 높으면 문법에서 벗어난 입력까지 만듭니다. 하나의 모델로 두 방향의 테스트가 가능합니다.',
        html: () => dir('lo', '낮은 온도 · 문법을 지키는 변형', ['01', '03', 'A3', '7F', '00', '1C'], [2], '형식은 그대로, 값만 변경 → 장비 내부 동작을 검사', 0)
          + dir('hi', '높은 온도 · 문법을 벗어나는 변형', ['01', '9C', 'FF', '7E', '00', '1C'], [1, 2, 3], '형식까지 변경 → 더 다양한 입력으로 넓게 검사', 300)
          + `<div class="tbar" style="--r:600ms"><div><i></i></div><small><span>문법 유지</span><span>온도</span><span>다양성</span></small></div>` },
      { title: '형식과 다양성을 함께 확보', desc: '규격서 기반은 입구를 통과하지만 비슷한 입력만 반복하고, 무작위 변이는 다양하지만 상당수가 입구에서 걸러집니다. 제안 방식은 다양한 입력이 입구를 통과해 장비 내부까지 검사합니다.',
        html: () => `<div class="gate"><div class="gate__hd"><span>입구 · 형식 검사</span><span>장비 내부 →</span></div>${[
          ['규격서 기반', '통과하지만 비슷한 입력', ['a', 'a', 'a', 'a'], []],
          ['무작위 변이', '다양하지만 입구에서 차단', ['a', 'b', 'c', 'd'], [1, 3]],
          ['제안 방식', '다양한 입력이 내부까지', ['a', 'b', 'c', 'd'], [], true],
        ].map(([name, note, kinds, blocked, me], k) => `<div class="gate__ln ${me ? 'gate__ln--me' : ''}"><b>${name}<small>${note}</small></b><div>${kinds.map((c, j) =>
          `<i class="${c} ${blocked.includes(j) ? 'x' : ''}" style="--to:${blocked.includes(j) ? 22 + j * 4 : 52 + j * 13}%;--s:${400 + k * 200 + j * 260}ms"></i>`).join('')}</div></div>`).join('')}</div>` },
    ],
  };

  /* ---------- steps: all shown at once; only the moving parts replay on a loop ---------- */
  document.querySelectorAll('[data-steps]').forEach(ol => {
    const flow = FLOWS[ol.dataset.steps];
    ol.innerHTML = flow.map((st, k) => `
      <li class="step in">
        <span class="step__n">${k + 1}</span>
        <div><div class="step__hd"><span class="step__tag">${ol.dataset.steps === 'detect' ? 'Detect' : 'Fuzz'}</span><b class="step__title">${st.title}</b></div>
          <p class="step__desc">${st.desc}</p>
          <div class="step__vis">${st.html()}</div></div>
      </li>`).join('');
  });
  const LOOP = 4500;   // longest figure (detect step 2) finishes in ~3.6s, then a short hold
  let figT = null;
  // masks being filled, the sliding mask and the quadrant dots/labels restart; everything else stays put
  const LOOPED = '.step__vis .sw i, .step__vis .hx--score b, .step__vis .st-mq i, .step__vis .gate i';
  const replay = () => {
    const els = rx.querySelectorAll(LOOPED);
    els.forEach(el => { el.style.animationName = 'none'; });
    void rx.offsetHeight;
    els.forEach(el => { el.style.animationName = ''; });
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
    pT.push(setTimeout(runPkt, t + 1000));
  };

  /* ---------- run while the Research tab is open ---------- */
  const sync = () => {
    const on = !panel.hidden;
    rx.classList.toggle('is-live', on);
    pT.forEach(clearTimeout); clearInterval(figT); figT = null;
    if (!on) return;
    runPkt(); replay();
    if (!reduce) figT = setInterval(replay, LOOP);
  };
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => setTimeout(sync, 30)));
  rx.querySelectorAll('.rx-fork__ends a').forEach(a => a.addEventListener('click', e => {
    e.preventDefault(); document.querySelector(a.getAttribute('href')).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  sync();
})();
