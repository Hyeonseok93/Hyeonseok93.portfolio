/* ---------- tabs; on phones and tablets they live in a menu under a sticky header ---------- */
(() => {
  const tabs = [...document.querySelectorAll('.tab')];
  const menuBtn = document.querySelector('.hd__menu'), cur = document.querySelector('.hd__cur');
  const narrow = matchMedia('(max-width: 768px)');
  const label = t => [...t.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
  const setMenu = open => {
    document.body.classList.toggle('nav-open', open);
    menuBtn.setAttribute('aria-expanded', open);
    menuBtn.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
  };
  let glide = 0;
  const glideTop = () => {
    cancelAnimationFrame(glide);
    const from = Math.min(scrollY, innerHeight * 0.6);
    if (from <= 0 || matchMedia('(prefers-reduced-motion: reduce)').matches) { scrollTo(0, 0); return; }
    scrollTo(0, from);
    const t0 = performance.now(), dur = 420;
    const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);   // ease-out cubic
      scrollTo(0, from * (1 - e)); if (k < 1) glide = requestAnimationFrame(step); };
    glide = requestAnimationFrame(step);
  };
  const select = t => {
    tabs.forEach(x => x.setAttribute('aria-selected', x === t));
    document.querySelectorAll('.panel').forEach(p => p.hidden = p.id !== t.dataset.p);
    cur.textContent = label(t);
  };
  tabs.forEach(t => t.addEventListener('click', () => {
    select(t);
    setMenu(false);
    // glide back to the top: start from at most ~60% of a screen down so the glide stays short,
    // and so a shorter new tab never snaps the page before the animation begins
    glideTop();
  }));
  menuBtn.addEventListener('click', () => setMenu(!document.body.classList.contains('nav-open')));
  document.querySelectorAll('[data-go]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault(); document.querySelector(`.tab[data-p=${a.dataset.go}]`)?.click();
  }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
  document.addEventListener('click', e => { if (!e.target.closest('.hd, .tabs')) setMenu(false); });
  narrow.addEventListener('change', () => setMenu(false));
  select(tabs.find(t => t.getAttribute('aria-selected') === 'true') || tabs[0]);
})();

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

/* ---------- Rookies and Personal tabs: projects on one page, each with a tilted wall of screens ---------- */
(() => {
  const root = document.querySelector('[data-rk]'), proot = document.querySelector('[data-ps]');
  if (!root || !proot) return;
  const GH = 'https://github.com/Hyeonseok93/', BLOG = 'https://hyeonseok93.github.io/posts/';

  // v1 copy: kicker, lede, flow (pipe = arrows between steps), role [what, %], env [category, stack]; points: [title, sentence, flow]
  const P = {
    mini1: { no: '01', tag: 'MINI 1', name: 'CVS Event Comparator', sub: '4사 편의점 행사 비교 대시보드', days: 5, team: 6, c: '#e3b341',
      kicker: "한곳에 모은 편의점 행사", pipe: true,
      lede: ["CU · GS25 · 7-Eleven · emart24 행사가 각 브랜드 앱과 웹사이트에 흩어져 있어, 혜택을 한곳에서 비교하기 어렵습니다.", "그래서 네 브랜드 행사 상품을 모아 한곳에서 비교·추천할 수 있는 통합 대시보드를 만들었습니다."],
      flow: [["수집", "4사 웹·API 크롤"], ["정제", "공통 스키마로 맞춤"], ["분류", "카테고리·행사 라벨"], ["대시보드", "비교·추천·챗봇"]],
      role: [["럭키박스 페이지", 100], ["크롤러 공통 구조·데이터 파이프라인 통합 설계", 100], ["핫딜 단가 계산", 90], ["브랜드 비교 UI", 80], ["AI 챗봇 – Groq 연동·검색 로직", 70], ["편의점 4사 크롤링 · emart24 담당", 25]],
      points: [
        ['브랜드별 수집', '응답 방식이 다른 네 사이트에 맞춰 크롤러를 나누고, 결과를 하나의 스키마로 통일했습니다.', 'Ajax HTML · JSON API · 페이지네이션 → brand · name · price · event'],
        ['정제 · 분류 배치', '매일 정제·분류를 돌리고, 한 곳이라도 수집에 실패하면 기존 카탈로그를 덮어쓰지 않습니다.', '4사 수집 → 정제 → 카테고리 분류 → 카탈로그'],
        ['행사 상품 챗봇', '질문 키워드로 관련 상품만 골라 LLM에 넣고, 목록에 없는 가격·행사는 답하지 않도록 제한했습니다.', '질문 → 상품 필터 → Groq Llama 3.3 → 스트리밍 응답'],
      ],
      why: {"lede": "편의점 4곳의 행사 상품을 모아 정제하고, 대시보드로 보여 준다.", "items": [{"title": "브랜드별 수집", "intro": ["각 브랜드는 자체 웹으로 행사를 운영하니, 데이터를 주는 방식도 제각각이다. 그래서 크롤러도 그 구조에 맞춰 나눠 수집하고, 모은 데이터는 brand, name, price, event, img_url로 통일했다."], "flow": "", "head": ["브랜드", "수집 방식"], "rows": [["CU", "Ajax HTML을 POST로 받아온다. 응답은 페이지네이션으로 잘려 있어서 page index를 올려 가며 요청하고, 각 페이지 HTML에서 상품 노드를 파싱해 적재한다. 빈 페이지가 나오면 수집을 종료한다."], ["GS25", "화면 크롤이 아니라 JSON API로 목록을 받는다. 먼저 HTML에서 CSRF 토큰을 추출한 뒤, 그 토큰을 붙여 페이지 단위로 API를 호출한다. 행사 유형은 API 코드값으로 오므로 1+1·2+1 라벨로 매핑해 저장한다."], ["7-Eleven", "행사 탭(1+1 / 2+1)이 파라미터로 분리되어 있다. 탭별로 Ajax POST를 보내며, page size를 크게 잡아 해당 행사 목록을 한 번에 받아 HTML에서 파싱한다."], ["emart24", "행사 종류(1+1 / 2+1 / 3+1)를 카테고리 파라미터로 고른 뒤, 그 안에서 page 기반 페이지네이션으로 GET 요청한다. 각 페이지의 상품 카드를 파싱하고, 빈 페이지면 다음 행사 카테고리로 넘어간다."]]}, {"title": "정제와 분류", "intro": ["네 갈래로 모은 원본을 하나의 카탈로그로 맞추는 정제·분류 단계를 둔다. 대시보드와 별도 배치로 매일 돌리며, 중간에 실패하면 기존 카탈로그를 덮어쓰지 않는다."], "flow": "4사 크롤 → 정제 → 카테고리 분류 → 행사 뉴스", "head": ["단계", "내용"], "rows": [["정제", "정규화를 위해 가격은 숫자만 남기고, 필수 값이 비었거나 중복인 행, 디폴트 이미지 상품은 제거한 뒤 통합 파일로 저장한다."], ["분류", "상품명 키워드로 식사류·음료·간식류·생활/위생용품·기타를 붙인다. 이후 필터·추천·브랜드 비교가 같은 카테고리 기준으로 돌아가게 한다."], ["뉴스", "CU·GS25·7-Eleven·emart24 각각의 공식 이벤트/소식 게시판을 Selenium으로 열어 읽어 별도 파일에 저장한다. 이 수집이 실패해도 상품 카탈로그 갱신은 그대로 끝낸다."], ["안전장치", "4사 중 하나라도 수집 파일에 문제가 있으면 정제·분류를 하지 않는다. 중간까지 모인 데이터로 완성본을 덮어쓰지 않기 위해서다."]]}, {"title": "챗봇 연동", "intro": ["화면에 플로팅 챗봇을 붙여, 편의점 행사·상품 질문에 바로 답하게 했다. 질문이 들어오면 키워드로 관련 상품만 골라 Groq Llama 3.3에 보내고, 답은 스트리밍으로 받는다."], "flow": "", "head": ["항목", "내용"], "rows": [["연결", "분류까지 끝난 상품 목록을 읽는다. 질문을 단어로 나눠 상품명·카테고리에 포함 여부로 걸러 내고, 많을 때는 상위 20개만 모델 입력에 넣는다. 최근 대화 몇 턴도 같이 넘겨 맥락을 유지한다."], ["역할", "상품 검색, 1+1·2+1 행사 확인, 카테고리 안내에 답한다. 넣어 준 목록 밖의 가격·행사는 지어내지 말고, 모르면 모른다고 말하도록 프롬프트로 제한한다."], ["예외", "걸리는 상품이 없으면 목록에서 소량만 골라 참고 문맥으로 넣는다. 답은 토큰 단위로 바로 화면에 흘려 보여 준다."]]}]},
      env: [["언어", ["Python"]], ["프레임워크", ["Streamlit"]], ["저장소", ["CSV (파일 기반)"]], ["IDE", ["Cursor", "VS Code"]], ["API", ["Groq", "Requests"]], ["라이브러리", ["Pandas", "Plotly", "Folium", "BeautifulSoup", "Selenium", "APScheduler", "Loguru"]]],
      repo: 'SK-Rookies5-MINI1_CVS-EVENT-COMPARATOR', post: 'rookies-showcase-mini1' },
    mini2: { no: '02', tag: 'MINI 2', name: 'MATE', sub: '스터디 · 프로젝트 팀 매칭 플랫폼', days: 8, team: 6, c: '#d2a8ff',
      kicker: "모집부터 팀 소통까지, 한 플랫폼에서", pipe: false,
      lede: ["프로젝트·스터디 팀원 모집이 오픈채팅·에브리타임에 흩어져 지원자와 합류 현황을 따로 관리해야 했습니다.", "그래서 모집부터 지원·팀 확정까지 한곳에서 관리하고, 매칭된 팀에는 전용 게시판을 제공하는 플랫폼을 만들었습니다."],
      flow: [["모집 관리", "작성·마감·재모집"], ["지원·매칭", "지원서·수락·거절"], ["팀 공간", "멤버 전용 게시판·댓글"]],
      role: [["회원가입·로그인·계정 찾기·회원정보 중복 확인 기능 구현", 100], ["모집글 CRUD·재모집 및 모집중·마감임박·마감 상태 로직", 90], ["MSW 목업 서버·API 연동(Axios 인터셉터)·Zustand 상태관리·MUI 테마", 90], ["팀 전용 게시판·댓글, 지원서, 마이페이지(내 모집·신청)", 80], ["백엔드 모집글·게시판 페이징·필터링 일부", 20]],
      points: [
        ['MSW 병렬 개발', '실제 API와 같은 주소·응답을 흉내 내는 목업 서버로 화면을 먼저 만들고, 설정값 하나로 실서버에 연결했습니다.', '목업 서버 → 화면 개발 → 설정 전환 → 실서버'],
        ['Silent JWT 갱신', '토큰이 만료되면 보안 쿠키의 재발급 토큰으로 새 토큰을 받고, 실패한 요청을 다시 보냅니다. 동시 만료 시 재발급은 한 번만 합니다.', '토큰 만료 → 재발급 → 대기 요청 재개 → 재전송'],
        ['API 응답 표준화', 'API마다 다른 필드 이름과 목록 형식을 변환 계층에서 하나의 내부 규격으로 맞췄습니다.', 'API 응답 → 변환 계층 → 화면 공통 규격'],
      ],
      why: {"lede": "프론트와 백엔드가 동시에 개발할 수 있도록 하고, 세션 만료와 API 스펙 차이를 프론트 계층에서 흡수했다.", "items": [{"title": "MSW 병렬 개발", "intro": ["백엔드가 완성되기 전에도 화면과 사용자 흐름을 먼저 만들 수 있도록, 실제 서버와 똑같은 요청 주소·응답 형태를 흉내 내는 가짜 서버(MSW)를 브라우저 안에 두었다. 화면은 진짜든 가짜든 같은 방식으로 데이터를 요청하기 때문에, 실제 서버로 바꿀 때 연동 코드를 다시 짜지 않아도 된다."], "flow": "", "head": ["항목", "내용"], "rows": [["전환", "개발 환경에서 모킹을 켰을 때만 가짜 서버가 동작한다. 미리 정의하지 않은 요청은 실제 서버로 그대로 흘려보내고, 운영 빌드에는 모킹 코드가 아예 포함되지 않는다."], ["범위", "로그인·아이디/전화번호 중복 확인·프로필 수정부터 모집글 작성·수정·삭제, 지원 수락/거절, 팀 게시판·댓글까지 핵심 흐름을 실제 API와 같은 주소 기준으로 구성했다."], ["재현", "성공뿐 아니라 빈 목록·권한 없음·중복·서버 오류 같은 예외 상황도 미리 흉내 내, 로딩·에러 화면과 사용자 안내 문구를 실제 연동 전에 검증했다."], ["효과", "프론트와 백엔드가 서로를 기다리지 않고 동시에 개발했고, 연동 단계에서는 설정값 하나만 바꿔 화면 수정 없이 실제 서버로 전환했다."]]}, {"title": "Silent JWT 갱신", "intro": ["로그인 토큰이 만료돼도 사용자를 바로 로그아웃시키지 않고, 보안 쿠키에 담긴 재발급 토큰으로 조용히 새 토큰을 받은 뒤 실패했던 요청을 자동으로 다시 보낸다. 동시에 몰린 요청과 탈취된 토큰 재사용까지 함께 처리한다."], "flow": "로그인 토큰 만료 → 자동 갱신 → 대기 요청 재개 → 끊겼던 요청 재전송", "head": ["항목", "내용"], "rows": [["분리", "로그인 확인용 토큰은 요청마다 실어 보내고, 재발급용 토큰은 자바스크립트가 읽지 못하는 보안 쿠키에만 담아 노출과 탈취 위험을 줄인다."], ["동시성", "여러 요청이 동시에 만료를 만나도 재발급은 한 번만 요청한다. 나머지 요청은 잠시 줄 세워 두었다가 새 토큰이 나오면 순서대로 다시 보낸다."], ["회전", "서버는 재발급 토큰을 원문 그대로 저장하지 않고 알아볼 수 없게 변환해 보관한다. 갱신할 때마다 토큰을 새것으로 바꾸고, 이미 쓴 토큰이 다시 들어오면 탈취로 보고 관련 토큰을 모두 무효화한다."], ["실패", "갱신이 안 되거나 토큰이 유효하지 않으면 로그인 상태를 지우고 로그인 화면으로 보내, 끝없이 재시도하지 않게 한다."]]}, {"title": "API 응답 표준화", "intro": ["API마다 데이터 이름과 목록 형식이 달라도 화면이 이를 직접 구분하지 않도록, 화면과 API 사이에 변환 계층을 두어 하나의 내부 규격으로 맞췄다. 화면은 API 형식이 아닌 공통 데이터 구조만 사용하므로, 응답이 바뀌어도 변환 로직 한곳만 고치면 된다."], "flow": "API 응답 → 변환 계층에서 표준화 → 화면 공통 규격", "head": ["항목", "내용"], "rows": [["이름", "같은 정보를 백엔드마다 다른 이름으로 줘도(사용자 번호, 프로필 이미지 주소 등) 화면에서는 하나의 이름으로 통일해 쓴다."], ["목록", "목록을 담아 주는 형식이 응답마다 달라도 같은 목록으로 읽어 들이고, 전체 페이지 수 같은 정보도 형식에 상관없이 인식한다."], ["검색", "화면의 한글 분류(프로젝트·스터디)를 서버가 이해하는 값으로 바꿔 보내고, 검색어·분류·정렬이 바뀌면 첫 페이지부터 다시 불러와 엉뚱한 빈 결과를 막는다."], ["상태", "서버 마감, 정원 충족, 마감일 경과는 마감으로 처리한다. 한 자리만 남거나 마감 3일 이내면 마감임박, 나머지는 모집중으로 계산한다."]]}]},
      env: [["언어", ["JavaScript", "Java"]], ["프레임워크", ["React", "Spring Boot"]], ["데이터베이스", ["MariaDB", "H2"]], ["빌드", ["Vite", "Maven"]], ["IDE", ["Cursor", "IntelliJ IDEA", "VS Code"]], ["라이브러리", ["MUI", "Zustand", "Axios", "React Router", "MSW", "Spring Security", "JPA", "JJWT", "Flyway", "Cloudinary"]]],
      repo: 'SK-Rookies5-MINI2_MATE', post: 'rookies-showcase-mini2' },
    mini3: { no: '03', tag: 'MINI 3', name: 'MACTA', sub: '실시간 경매 플랫폼', days: 8, team: 6, c: '#3fb950',
      kicker: "마감 직전에도 따라잡는 실시간 경매", pipe: false,
      lede: ["마감이 다가올수록 입찰이 한꺼번에 몰리고, 최고가가 덮어씌워지거나 내 입찰·낙찰 현황을 놓치기 쉽습니다.", "그래서 낙관적 락으로 동시 입찰을 맞추고, 실시간 최고가와 상회 알림부터 결제·배송까지 한곳에서 이어가는 경매 플랫폼을 만들었습니다."],
      flow: [["실시간 입찰", "낙관적 락·최고가 동기화"], ["상회 알림", "입찰·낙찰 이벤트"], ["낙찰 거래", "결제·배송 이어가기"]],
      role: [["프론트엔드 스캐폴드·레이아웃·공통 UI 및 Axios API 연동", 90], ["Zustand 인증·서버 시간 동기화·라이브 입찰 폴링 UX", 90], ["경매 상세·입찰·등록·결제·알림·마이페이지 화면", 80], ["백엔드 경매 API·입찰 응답·마이페이지 상태·알림", 30]],
      points: [
        ['서버 시간 동기화', '기기 시계 대신 서버 시각과의 차이를 기준으로 카운트다운과 입찰 가능 여부를 계산합니다.', '서버 시각 → RTT 보정 → 기준 시각 → 카운트다운'],
        ['낙관적 락 동시 입찰', '@Version으로 동시 입찰 충돌을 감지해, 먼저 커밋된 입찰만 최고가에 반영합니다.', '입찰 → 최고가 검증 → version 갱신 → 충돌 시 실패'],
        ['GitOps 무중단 배포', '이미지 태그만 갱신하면 Argo CD가 EKS를 맞추고, Rolling Update로 배포 중에도 요청이 끊기지 않습니다.', '빌드 → ECR → Manifest → Argo CD → Rolling Update'],
      ],
      why: {"lede": "마감 시각과 최고가가 어긋나지 않도록 서버 기준으로 맞추고, 동시 입찰과 배포 중단까지 함께 잡았다.", "items": [{"title": "서버 시간 동기화 · 실시간 입찰 UX", "intro": ["클라이언트 시계가 어긋나면 마감 카운트다운과 입찰 가능 여부가 틀어진다. 그래서 화면은 기기 시각이 아니라 서버와의 오프셋을 기준으로 남은 시간을 계산하고, 경매 상세에서는 최고가·잔여 시간·입찰 상태를 실시간으로 따라가게 했다."], "flow": "서버 시각 → RTT 보정 → 기준 시각 → 실시간 입찰", "head": ["항목", "내용"], "rows": [["기준 시각", "사용자 PC 시계가 틀어져 있으면 마감 시간도 어긋난다. 그래서 PC 시계 대신 서버가 알려 준 시각을 기준으로 삼고, 마감·잔여 시간을 계산한다."], ["기준", "카운트다운·입찰 버튼 활성/비활성·마감 임박 표시는 모두 같은 서버 기준 시각을 쓴다. 기기 시계만 믿는 경우를 제거했다."], ["동기화", "상세 화면에서 최고가·입찰 내역·잔여 시간을 서버 상태와 맞춰, 새로고침 없이도 경쟁 중인 상태를 따라간다. 전달 채널은 이후 WebSocket으로 바꿔도 같은 UX 계약을 유지하도록 화면과 분리했다."], ["효과", "마감 직전에도 “아직 남은 줄 알았는데 이미 끝” 같은 시각 불일치를 줄이고, 최고가 변화를 끊김 없이 보여 준다."]]}, {"title": "낙관적 락 동시 입찰", "intro": ["마감 직전 여러 입찰이 동시에 들어오면 최고가가 덮어씌워질 수 있다. Auction에 @Version 낙관적 락을 두고, 현재 최고가 검증과 갱신을 한 트랜잭션에서 처리해 먼저 커밋된 요청만 반영한다."], "flow": "입찰 요청 → 최고가 검증 → version 갱신 → 충돌 시 실패", "head": ["항목", "내용"], "rows": [["검증", "입찰 금액이 현재 최고가보다 높을 때만 허용한다. 낮거나 같은 금액, 종료된 경매 입찰은 비즈니스 예외로 차단한다."], ["버전", "같은 경매를 동시에 수정하면 @Version 충돌을 감지한다. 먼저 커밋된 입찰만 최고가·최고 입찰자를 갱신하고, 나머지는 실패 처리한다."], ["일관성", "검증과 저장을 한 트랜잭션에 묶어, 읽은 뒤 쓰기 사이의 Race Condition과 중복 갱신을 줄인다."], ["효과", "최종 입찰가와 낙찰자 정보가 어긋나지 않게 남아, 이후 결제·배송 단계의 기준이 흔들리지 않는다."]]}, {"title": "GitOps · Rolling Update", "intro": ["이미지 빌드·ECR Push 후 Infra Manifest의 이미지 태그를 갱신하면 Argo CD가 EKS 상태를 맞춘다. Deployment는 Rolling Update로 Pod를 순차 교체해, 배포 중에도 입찰·화면 요청이 끊기지 않게 했다."], "flow": "이미지 빌드 → ECR → Manifest → Argo CD → Rolling Update", "head": ["항목", "내용"], "rows": [["분리", "앱 코드와 배포 선언을 레포로 나눈다. Actions가 이미지를 빌드·푸시하고, Infra Manifest만 배포 대상을 가리킨다."], ["동기화", "Argo CD가 Git에 선언된 Manifest와 클러스터 실제 상태를 비교해 자동으로 맞춘다. 배포 이력과 설정이 Git에 남아 추적·롤백이 쉽다."], ["무중단", "새 버전 서버가 준비된 것을 확인한 뒤에만 이전 서버를 내린다. 준비되지 않은 서버로는 요청이 가지 않아, 배포 중에도 서비스가 끊기지 않는다."], ["효과", "실시간 경매 특성상 배포 중에도 서비스 가용성을 유지하고, 문제 시 이전 ReplicaSet으로 빠르게 되돌릴 수 있다."]]}]},
      env: [["언어", ["TypeScript", "Java"]], ["프레임워크", ["React", "Spring Boot"]], ["데이터베이스", ["MariaDB", "Redis"]], ["인프라", ["Docker", "Kubernetes", "Terraform", "AWS", "Argo CD"]], ["빌드", ["Vite", "Maven", "GitHub Actions"]], ["라이브러리", ["Tailwind CSS", "TanStack Query", "Zustand", "Axios", "Spring Security", "JWT", "Hibernate"]]],
      repo: 'SK-Rookies5-MINI3_MACTA', post: 'rookies-showcase-mini3' },
    onde: { no: 'F1', tag: 'FINAL · TARGET', name: 'ONDE', sub: '진단 대상으로 만든 여행 플랫폼', days: 35, team: 7, c: '#4493f8',
      kicker: "바이브 코딩으로 만든 여행 플랫폼, 진단의 타깃", pipe: false,
      lede: ["숙소부터 항공·렌터카·보험까지 한 흐름으로 이어지는 여행 플랫폼을 바이브 코딩으로 만들었습니다.", "그렇게 올린 코드에서 취약점이 실제로 얼마나 드러나는지 보기 위해, 이 서비스를 진단 대상으로 삼았습니다."],
      flow: [["통합 예약", "검색부터 결제까지"], ["여행자 보험", "견적·가입까지"], ["운영 콘솔", "셀러·관리자 백오피스"]],
      role: [["프론트엔드 숙소·항공·렌터카·지도·피드·결제·셀러/어드민 UI", 80], ["프론트–백엔드 연동", 75], ["백엔드 Flyway 스키마·시드/테스트 데이터 프로비저닝", 60], ["로컬 MinIO·S3·인증 데이터 및 인벤토리 캘린더 API", 55]],
      points: [
        ['항공 좌석 임시 선점', '같은 좌석 요청을 분산 잠금으로 하나씩 처리하고, 결제 전 10분 동안만 좌석을 잡아 둔 뒤 자동으로 풀어 줍니다.', '예약 → 직렬 처리 → 좌석 차감 → 결제 대기 → 만료 복구'],
        ['테스트 데이터 프로비저닝', '로컬에서는 MinIO로 S3와 같은 업로드 경로를 쓰고, 수집한 데이터를 스키마에 맞게 변환해 적재했습니다.', '수집 → 정리 → 스키마 변환 → DB 적재'],
        ['날짜별 재고 달력', '숙소와 렌터카가 같은 달력 규칙을 공유하고, 기록이 없는 날은 마감으로 처리합니다.', '월 선택 → 재고 조회 → 빈 날 마감 → 예약'],
      ],
      why: {"lede": "동시 예약과 날짜별 재고가 어긋나지 않게 맞추고, 로컬에서는 MinIO·테스트 데이터로 같은 흐름을 먼저 돌렸다.", "items": [{"title": "항공 좌석 임시 선점", "intro": ["같은 편·같은 등급에 예약이 한꺼번에 들어오면 남은 자리가 어긋날 수 있고, 결제 전에 자리를 잡아 두고 나가 버리면 그 좌석이 계속 막힐 수 있다. 그래서 예약이 들어올 때 한 줄로 줄을 세운 뒤 재고를 줄이고, 결제가 끝나기 전에는 “잠시 잡아 둔 상태”로만 두었다. 정해 둔 시간이 지나면 자리를 다시 풀어 준다."], "flow": "예약 → 직렬 처리 → 좌석 차감 → 결제 대기 선점 → 만료 복구", "head": ["항목", "내용"], "rows": [["동시성", "여러 사용자가 같은 좌석 등급을 거의 동시에 골라도, 서버끼리 공유하는 잠금으로 한 번에 하나만 재고를 건드린다. 서로 다른 서버에 요청이 흩어져도 같은 규칙을 쓴다."], ["선점", "자리가 남아 있을 때만 예약을 만든다. 만든 직후에는 결제 전 임시 상태로 두고, 약 10분 안에 결제를 마치지 않으면 선점이 풀리도록 기한을 붙인다."], ["복구", "백그라운드에서 기한이 지난 임시 예약을 주기적으로 찾아, 막혀 있던 좌석 수를 되돌리고 예약을 시간 초과 취소로 바꾼다. 이미 결제까지 끝난 예약은 건드리지 않는다."], ["효과", "자리가 음수로 내려가는 일(오버부킹)과, 결제 안 한 채 좌석만 영원히 잡아 두는 일을 같은 흐름에서 줄인다."]]}, {"title": "MinIO 로컬 테스트 · 스크래핑 데이터 프로비저닝", "intro": ["운영에서는 파일을 S3에 올리고, 로컬에서는 같은 업로드 흐름로 MinIO에 붙여 이미지·첨부 흐름을 먼저 검증했다. 더 중요했던 건 데모·진단용 데이터였다. 테스트에 쓸 숙소·항공 등 정보를 밖에서 모아 온 뒤, 그대로 넣지 않고 우리 테이블·관계·식별자에 맞게 다듬어 넣는 프로비저닝을 따로 두었다."], "flow": "S3 / MinIO(로컬) → 수집 정리 → 스키마 변환 → DB 적재", "head": ["항목", "내용"], "rows": [["저장소", "클라우드에서는 S3, 개발 PC에서는 MinIO로 같은 업로드 경로를 탄다. 로컬에서도 이미지·첨부를 올리면 서비스가 그 주소를 받아 목록·상세에 보여 주는 흐름을, 운영과 비슷한 방식으로 확인할 수 있다."], ["수집", "검색·예약·지도가 비어 있으면 흐름을 돌리기 어렵다. 그래서 테스트용으로 외부에서 상품·일정 성격의 데이터를 모아 왔다."], ["프로비저닝", "긁어 온 원본을 그대로 쓰지 않는다. 우리 쪽 상품 종류, 판매자·회원 연결, 날짜별 재고·좌석 구조에 맞게 필드와 관계를 맞춘 뒤 넣는다. DB 뼈대를 먼저 올리고, 서버가 준비된 다음에 대량으로 적재한다."], ["효과", "로컬에서 업로드 경로를 검증하면서, 로그인·검색·예약이 실제로 돌아갈 만큼의 현실적인 데이터 세트를 같은 환경에 올려 둘 수 있다."]]}, {"title": "숙소·렌터카 날짜별 재고 달력", "intro": ["숙소와 렌터카는 상품은 다르지만, “어느 날에 몇 개·얼마인지”를 달력으로 보여 줘야 한다는 점은 같다. 각각 다른 API로 나누면 판매자 화면용·구매자 화면용 달력 로직이 따로따로 생기고, 나중에 맞추기도 어렵다. 그래서 날짜마다 재고와 가격을 적어 두는 공통 규칙을 두고, 숙소·렌터카가 같은 달력 응답을 쓰게 했다."], "flow": "월 선택 → 재고 조회 → 일자 채움 → 빈날 마감 → 구매·판매", "head": ["항목", "내용"], "rows": [["공통 규칙", "상품 종류와 상품 ID, 날짜를 키로 그날의 재고·가격을 둔다. 숙소와 렌터카가 같은 달력 만들기 규칙을 공유한다."], ["기본값", "그날 기록이 없으면 “팔 수 있음”이 아니라 “마감”으로 채운다. 판매자가 열어 둔 날만 예약할 수 있게 해서, 빈칸이 의도치 않은 판매로 이어지지 않게 했다."], ["화면", "구매자 상세의 달력과 판매자 재고 조정이 같은 월 단위 데이터를 본다. 한쪽만 고치면 다른 쪽이 어긋나는 일을 줄인다."], ["효과", "두 상품군의 날짜별 재고 UX를 한 흐름으로 유지하면서, 숙소·차량 자체 정보는 따로 둘 수 있다."]]}]},
      env: [["언어", ["TypeScript", "Java"]], ["프레임워크", ["React", "Spring Boot"]], ["데이터베이스", ["MariaDB", "Redis"]], ["인프라", ["Docker", "Nginx", "Terraform", "AWS", "MinIO"]], ["빌드", ["Vite", "Gradle", "GitHub Actions"]], ["라이브러리", ["Tailwind CSS", "Zustand", "Axios", "Leaflet", "Spring Security", "JWT", "Flyway", "Hibernate"]]],
      repo: 'SK-Rookies5-FINAL_ONDE', post: 'rookies-showcase-final1' },
    argus: { no: 'F2', tag: 'FINAL · DIAGNOSTICS', name: 'ARGUS', sub: '웹 · API 자동 취약점 진단 플랫폼', days: 22, team: 7, c: '#f78166',
      kicker: "수동 진단을 자동화하는 웹·API 진단 플랫폼", pipe: true,
      lede: ["사람이 엔드포인트를 하나씩 눌러 보던 취약점 검사를, 항목별 진단 모듈로 수만 건까지 빠르게 돌릴 수 있게 만들었습니다.", "대상 API를 모은 뒤 모듈이 검사하고, 증적 스크린샷과 결과서 PDF까지 남깁니다."],
      flow: [["데이터 수집", "API·엔드포인트 수집"], ["진단", "항목별 모듈 스캔"], ["스크린샷 캡쳐", "증적 이미지 저장"], ["결과서 작성", "PDF 생성·다운로드"]],
      role: [["대상 서비스 API·엔드포인트 수집·응답 검증", 85], ["진단 결과·상세 화면 프론트엔드", 85], ["취약점 진단 모듈·판정 로직", 45], ["진단 증적 스크린샷 자동화", 20], ["진단 결과서 PDF 생성·다운로드", 15], ["인프라 CD·실배포 검증", 15]],
      points: [
        ['대상 수집 · 검증', 'URL · API · Swagger 목록으로 경로를 모으고, 실제 응답이 확인된 경로만 진단 대상으로 확정합니다.', '기준 URL → 경로 수집 → 응답 검증 → 확정 목록'],
        ['항목별 진단 모듈', '확정된 목록 위에서 항목별 모듈이 검사하고, 결과를 통과 · 주의 · 실패로 자동 판정합니다.', '확정 목록 → 모듈 실행 → 자동 판정 → 결과 저장'],
        ['증적 · 결과서', 'Playwright로 재현 화면을 캡처하고, 진단 결과와 묶어 PDF 결과서로 만듭니다.', '진단 결과 → 화면 캡처 → PDF → 다운로드'],
      ],
      why: {"lede": "대상 API를 모으고 응답으로 걸러 낸 뒤, 항목별 모듈이 자동 판정하고 증적·결과서까지 이어지게 했다.", "items": [{"title": "대상 API·엔드포인트 수집·응답 검증", "intro": ["진단은 대상이 틀리면 결과가 무의미하다. 그래서 URL·API·Swagger 목록으로 API·화면 경로를 먼저 모은 뒤, 실제로 요청을 보내 응답이 확인된 것만 남겼다. 이후 진단 모듈은 이 목록만 읽도록 맞춰 두었다."], "flow": "기준 URL → 목록 수집 → 응답 검증 → 확정 목록 저장", "head": ["항목", "내용"], "rows": [["수집", "URL·API·Swagger 목록을 합쳐 대상 서비스의 API·화면 경로를 한 목록으로 만든다."], ["검증", "모아 둔 경로에 실제 HTTP 요청을 보낸다. 연결 실패·404처럼 쓸 수 없는 경로는 빼고, 응답이 확인된 것만 남긴다."], ["저장", "수집 직후 목록과 검증 후 목록을 파일로 나눠 둔다. 진단은 검증을 통과한 목록을 우선해 읽는다."], ["효과", "추측으로 잡은 주소가 아니라, 응답이 확인된 대상만 이후 진단에 넘긴다."]]}, {"title": "항목별 진단 모듈·자동 판정", "intro": ["사람이 엔드포인트를 하나씩 눌러 보던 검사를, 항목별 진단 모듈이 같은 대상 목록 위에서 반복하도록 만들었다. 모듈마다 입력·검사·판정 규칙을 두고, 결과는 통과·주의·실패로 자동 정리한다. 긴 검사는 백그라운드에서 돌리고 진행률을 화면에서 따라가게 했다."], "flow": "확정 목록 → 모듈 실행 → 자동 판정 → 결과 저장", "head": ["항목", "내용"], "rows": [["입력", "응답 검증을 거친 API 목록과 기준 URL, 필요하면 로그인·다운로드 경로를 모듈 입력으로 쓴다."], ["검사", "항목별 모듈이 대상에 요청을 보내고, 응답·헤더·규칙에 맞춰 취약 여부를 본다. 사람이 하던 반복 검사를 수만 건 규모로 돌릴 수 있게 했다."], ["판정", "심각도·신뢰도에 따라 통과·주의·실패를 자동으로 매기고, 섹션별 결과 파일에 남긴다."], ["효과", "같은 대상 목록 위에서 항목마다 같은 방식으로 재실행할 수 있고, 수동으로 누르던 검사를 모듈 실행으로 대체한다."]]}, {"title": "증적 스크린샷·결과서 PDF", "intro": ["판정만 있으면 재현·보고가 어렵다. 그래서 진단이 끝난 뒤 Playwright로 관련 화면을 찍어 증적으로 붙이고, 결과와 증적을 묶어 PDF 결과서로 만들었다. 화면에서는 섹션별로 바로 내려받을 수 있게 연동했다."], "flow": "진단 결과 → 화면 캡처 → PDF 생성 → 다운로드", "head": ["항목", "내용"], "rows": [["증적", "진단 직후 Playwright로 재현에 필요한 화면을 캡처해, 해당 진단 결과 폴더 아래 증적 경로에 저장한다."], ["결과서", "진단 결과와 증적을 HTML·PDF로 묶는다. 섹션에 따라 Playwright PDF 또는 ReportLab을 쓰고, 필요하면 PDF를 합친다."], ["다운로드", "진단 화면에서 섹션별 PDF·문서를 API로 받아 바로 저장할 수 있게 붙였다."], ["효과", "판정 숫자만 남기지 않고, 보고·재현에 쓸 화면 증거와 결과서를 같은 파이프라인에서 만든다."]]}]},
      env: [["언어", ["TypeScript", "Python"]], ["프레임워크", ["React", "FastAPI"]], ["진단", ["OWASP ZAP", "Playwright", "httpx"]], ["인프라", ["Docker", "Nginx", "Terraform", "AWS"]], ["빌드", ["Vite", "GitHub Actions"]], ["라이브러리", ["Tailwind CSS", "Lucide", "Pydantic", "ReportLab", "PyYAML"]]],
      repo: 'SK-Rookies5-FINAL_ARGUS', post: 'rookies-showcase-final2' },
    canary: { no: 'P1', tag: 'PERSONAL · WEB', name: 'Code Canary', sub: 'CVE · OSV 취약점 인텔리전스 대시보드', days: 52, team: 1, c: '#f2cc60', dir: 'personal',
      kicker: "NVD·OSV 취약점을 한곳에서 모아 보는 웹", pipe: true,
      lede: ["출처마다 사이트를 오가던 CVE와 오픈소스 취약점(OSV) 정보를 한곳에 모아 정제하고, 누구나 검색·분석할 수 있는 공개 화면과 관리자용 운영 콘솔까지 한 서비스로 만들었습니다.", "공개 대시보드와 운영 콘솔을 권한으로 가르고, 백만 건 규모 목록을 검색과 차트로 한눈에 볼 수 있게 정리했습니다."],
      flow: [["수집", "NVD·OSV 피드 받기"], ["원본 적재", "받은 데이터 보관"], ["정규화", "검색·상세용 표로 맞춤"], ["탐색·운영", "공개 검색 · 관리자 콘솔"]],
      role: [["취약점 대시보드 · 검색 화면", 100], ["API · 로그인 · 관리자 콘솔", 100], ["취약점 수집 Worker · 데이터 파이프라인", 100], ["PostgreSQL · Redis 스키마 · 집계", 100], ["Docker Compose · Terraform · ECS 배포", 100]],
      points: [["NVD · OSV 통합 수집", "Worker가 두 피드를 받아 한 저장소에 쌓고, 검색·차트는 그 결과만 읽습니다.", "NVD·OSV 피드 → 수집 → 원본 보관 → 정규화 → 검색·차트"], ["단계별 데이터 정제", "원본 보관, 검색용 표, 대시보드용 집계를 나눠 공개 화면은 마지막 집계만 읽습니다.", "원본 보관 → 검색용 표 → 집계 스냅샷 → 대시보드·검색"], ["공개 검색 · 관리자 운영 분리", "누구나 쓰는 대시보드·검색과 로그인 뒤 관리자 콘솔을 경로·권한으로 나눴습니다.", "공개 화면 → 검색·차트 ·|· 관리자 로그인 → 수집 잡·진행 모니터"]],
      why: {"lede": "두 출처 취약점을 모아 단계별로 정제하고, 공개 검색과 관리자 운영을 한 서비스 안에서 갈랐다.", "items": [{"title": "NVD·OSV를 한곳에서 모은다", "intro": ["공식 CVE(NVD)와 오픈소스 쪽 취약점(OSV)은 출처·ID·표현이 달라, 사이트를 나눠 보면 같은 이슈가 어떻게 이어지는지 잘 안 보인다. 그래서 Worker가 두 피드를 받아 한 저장소에 쌓고, 이후 검색·차트는 그 결과만 읽도록 맞췄다."], "flow": "NVD·OSV 피드 → 수집 → 원본 보관 → 정규화 → 검색·차트", "head": ["항목", "내용"], "rows": [["수집", "NVD API와 OSV 전체 피드를 받아 스테이징에 쌓는다. 전체·증분 모드를 두고 동기화 시각을 남긴다."], ["원본", "받은 JSON을 원본 테이블에 보관한다. 내용이 같으면 건너뛰고, 바뀐 행만 다시 정제 대상으로 표시한다."], ["정규화", "원본을 CVE·OSV용 표와 설명·심각도·패키지 영향 같은 하위 테이블로 풀어, 화면이 바로 조인할 수 있게 맞춘다."], ["효과", "출처를 오가지 않고, 같은 목록·상세·차트에서 두 피드를 비교·검색할 수 있다."]]}, {"title": "원본·표·화면용 집계를 단계로 나눈다", "intro": ["백만 건에 가까운 카탈로그를 한 테이블에 섞으면 “다시 받기 / 다시 풀기 / 화면만 갱신”이 한꺼번에 꼬인다. 그래서 원본 보관, 검색용 표, 대시보드용 집계를 단계로 갈라 두고, 공개 화면은 마지막 집계만 읽게 했다."], "flow": "원본 보관 → 검색용 표 → 집계 스냅샷 → 대시보드·검색", "head": ["항목", "내용"], "rows": [["원본", "피드 그대로를 남겨, 나중에 재수집·재정제해도 근거를 잃지 않게 한다."], ["표", "정규화된 행으로 목록·상세·필터 검색을 돌린다. 전수 스캔을 화면 요청마다 반복하지 않도록 맞춘다."], ["집계", "소스 비중·성장 차트·요약 카드용 숫자를 따로 뽑아 두고, 대시보드는 그 스냅샷만 읽는다."], ["효과", "수집 파이프와 화면 조회가 서로를 막지 않고, 규모가 커져도 검색·차트를 바로 볼 수 있다."]]}, {"title": "공개 검색과 관리자 운영을 가른다", "intro": ["취약점 목록은 공개해도, 수집 잡을 돌리고 파이프라인을 만지는 손은 열어 두면 안 된다. 그래서 누구나 쓰는 대시보드·검색과, 로그인 뒤에만 쓰는 관리자 콘솔을 경로·권한으로 나눴다."], "flow": "공개 화면 → 검색·차트 ·|· 관리자 로그인 → 수집 잡·진행 모니터", "head": ["항목", "내용"], "rows": [["공개", "대시보드 요약·취약점 검색·상세는 로그인 없이 집계·정규화 결과만 읽는다."], ["관리자", "수집·적재·정규화·집계 단계를 큐에 넣고, 성공·실패·로그를 모니터한다. JWT(HttpOnly)로 세션을 유지한다."], ["보호", "로그인 실패 잠금·운영 API 한도는 Redis로 막고, 캐시가 죽으면 한도를 건너뛰지 않고 요청을 거절한다."], ["효과", "카탈로그는 열어 두되, 파이프라인을 돌리는 표면은 관리자만 만지게 한다."]]}]},
      env: [["언어", ["TypeScript", "Java", "Python"]], ["프레임워크", ["React", "Spring Boot"]], ["저장소", ["PostgreSQL", "Redis"]], ["인프라", ["Docker", "Terraform", "AWS"]], ["빌드", ["Vite", "GitHub Actions"]], ["데이터", ["NVD API", "OSV"]]],
      repo: 'WEB_Code-Canary', post: 'code-canary' },
    patience: { no: 'P2', tag: 'PERSONAL · WEB', name: 'Patience Flashcard', sub: '페이션스형 다층 암기 웹', days: 4, team: 1, c: '#56d364', dir: 'personal',
      kicker: "페이션스형 다층 암기 웹", pipe: true,
      lede: ["한 장씩만 넘기는 암기가 아니라, 여러 층에 카드를 나눠 두고 기억·까먹음으로 올리고 내리는 페이션스형 보드를 웹으로 옮겼습니다.", "가입·로그인 후 공용 시드나 내가 등록한 카드 세트를 고르고, 학습 진행도를 저장하며 학습을 이어갈 수 있습니다."],
      flow: [["가입·OTP", "이메일 인증"], ["로그인", "JWT HttpOnly 세션"], ["세트 선택", "기본 제공 · 내 세트"], ["다층 플레이", "진행 저장·이어하기"]],
      role: [["다층 학습 엔진 · 플레이 UI", 100], ["OTP · JWT 인증", 100], ["덱 · 진행도 API · PostgreSQL", 100], ["Docker Compose · Nginx", 100]],
      points: [["페이션스형 다층 보드", "카드를 여러 층에 두고, 기억하면 위로·까먹으면 아래로 보내는 규칙을 웹으로 옮겼습니다.", "세트 선택 → 카드 제시 → 기억 / 까먹음 / 다음 → 층 이동"], ["계정 · 진행도 저장", "이메일 OTP 가입과 쿠키 세션을 두고, 세트별 층·대기열 상태를 DB에 남깁니다.", "OTP 가입 → 로그인 → 플레이 → 진행 저장 → 이어하기"], ["공용 세트 · 내 세트 권한", "기본 세트는 플레이만, 내 세트만 이름·카드 수정과 엑셀 교체가 됩니다.", "기본 제공 / 내 세트 → 플레이 ·|· 내 세트만 편집·엑셀"]],
      why: {"lede": "다층 암기 보드를 웹으로 옮기고, 계정마다 진행도를 남기며 공용 세트와 내 세트를 권한으로 갈랐다.", "items": [{"title": "페이션스형 다층 학습 보드", "intro": ["한 장씩만 넘기는 암기 대신, 카드를 여러 층에 나눠 두고 기억이면 위로·까먹으면 아래로 보내는 규칙을 웹에 옮겼다. 컨셉 자체는 이미 쓰이던 방식을 따른 것이고, 브라우저에서 같은 루프가 돌아가게 하는 데 초점을 뒀다."], "flow": "세트 선택 → 카드 제시 → 기억 / 까먹음 / 다음 → 층 이동", "head": ["항목", "내용"], "rows": [["층", "카드를 레벨별 스택에 두고, 현재 보는 카드만 크게 보여 준다. 위층으로 갈수록 “이미 익숙한 쪽”에 가깝다."], ["조작", "기억이면 위로, 까먹으면 아래로 보낸다. “다음”은 대기열에서 새 카드를 끌어와 손에 채운다."], ["화면", "가로로 넓은 화면에서는 카드와 층 스택을 나란히 두고, 세로·모바일에서는 위·아래로 쌓아 같은 규칙을 유지한다."], ["효과", "단순 플립이 아니라, 익숙도에 따라 카드가 층을 오가며 반복되는 암기 루프를 웹에서 돌릴 수 있다."]]}, {"title": "계정·진행도를 서버에 남긴다", "intro": ["처음에는 로컬 저장만으로도 플레이가 됐지만, 계정마다 이어하기와 클리어 기록을 남기려면 서버가 필요했다. 이메일 OTP로 가입하고, 로그인 세션은 쿠키로 유지한 뒤, 세트별 층·대기열 상태를 DB에 저장한다."], "flow": "OTP 가입 → 로그인 → 플레이 → 진행 저장 → 이어하기", "head": ["항목", "내용"], "rows": [["가입", "이메일로 인증 코드를 보내고 확인한 뒤에야 계정을 만든다. 로컬에서는 메일 UI로 코드를 확인할 수 있다."], ["세션", "로그인 후 JWT를 HttpOnly 쿠키로 둔다. 프론트는 같은 오리진의 API만 호출한다."], ["진행", "사용자·세트 단위로 층·대기열·클리어 횟수를 저장한다. 새로고침·이탈 후에도 이어하기가 가능하게 맞췄다."], ["효과", "기기·탭을 바꿔도 같은 계정으로 학습 위치를 잃지 않는다."]]}, {"title": "공용 세트와 내 세트를 가른다", "intro": ["누구나 쓰는 기본 제공 세트와, 내가 만든 세트를 같은 테이블에 두되 권한은 다르게 둔다. 공용은 읽기·플레이만 되고, 내 세트만 이름 변경·카드 수정·엑셀 교체가 된다."], "flow": "기본 제공 / 내 세트 → 플레이 ·|· 내 세트만 편집·엑셀", "head": ["항목", "내용"], "rows": [["공용", "시드로 넣어 둔 세트. 누구나 고르고 학습할 수 있지만 내용을 바꾸지는 못한다."], ["내 세트", "소유자에게만 이름·카드 CRUD·xlsx 가져오기가 열린다. 원본 파일은 보관하지 않고 파싱한 카드만 넣는다."], ["경계", "남의 세트·없는 세트를 수정 API로 건드리면 권한 오류로 막는다. 화면에서도 접근 거부와 일반 오류를 구분해 보여 준다."], ["효과", "같은 학습 엔진 위에서, 공용 시드와 개인 세트를 섞지 않고 안전하게 운영할 수 있다."]]}]},
      env: [["언어", ["TypeScript", "Java"]], ["프레임워크", ["React", "Spring Boot"]], ["저장소", ["PostgreSQL"]], ["인프라", ["Docker", "Nginx"]], ["빌드", ["Vite"]], ["인증", ["JWT", "Spring Security"]]],
      repo: 'WEB_Patience-Flashcard', post: 'patience-flashcard' },
  };

  // stack badges reuse the v1 portfolio look (Groq, BeautifulSoup, Zustand icons are our own)
  const ICON = { Python: 'python.png', Streamlit: 'streamlit.png', Selenium: 'selenium.png', Pandas: 'pandas.svg', BeautifulSoup: 'beautifulsoup.svg',
    Groq: 'groq.svg', Zustand: 'zustand.png', React: 'react.png', 'Spring Boot': 'spring.png', 'Spring Security': 'springsecurity.svg', MariaDB: 'mariadb.png',
    MSW: 'msw.svg', TypeScript: 'typescript.png', JavaScript: 'javascript.png', Java: 'java.png', Redis: 'redis.svg', Kubernetes: 'kubernetes.svg',
    'Argo CD': 'argocd.svg', Terraform: 'terraform.svg', AWS: 'aws.png', FastAPI: 'fastapi.png', 'OWASP ZAP': 'owasp.svg', Playwright: 'playwright.svg',
    'CSV (파일 기반)': 'csv.svg', Cursor: 'cursor.svg', 'VS Code': 'vscode.svg', Requests: 'requests.svg', Plotly: 'plotly.svg', Folium: 'folium.svg',
    APScheduler: 'apscheduler.svg', Loguru: 'loguru.svg', H2: 'h2.svg', Vite: 'vite.svg', Maven: 'maven.svg', 'IntelliJ IDEA': 'intellij.svg',
    MUI: 'mui.svg', Axios: 'axios.svg', 'React Router': 'reactrouter.svg', JPA: 'jpa.svg', JJWT: 'jwt.svg', JWT: 'jwt.svg', Flyway: 'flyway.svg',
    Cloudinary: 'cloudinary.svg', Docker: 'docker.svg', 'GitHub Actions': 'githubactions.svg', 'Tailwind CSS': 'tailwind.svg', 'TanStack Query': 'tanstack.svg',
    Hibernate: 'hibernate.svg', Nginx: 'nginx.svg', MinIO: 'minio.svg', Gradle: 'gradle.svg', Leaflet: 'leaflet.svg', httpx: 'httpx.svg',
    Lucide: 'lucide.svg', Pydantic: 'pydantic.svg', ReportLab: 'reportlab.svg', PyYAML: 'pyyaml.svg',
    PostgreSQL: 'postgresql.svg', 'NVD API': 'nvd.svg', OSV: 'osv.svg' };
  const badge = s => `<span class="tech">${ICON[s] ? `<img src="assets/icons/stack/${ICON[s]}" alt="">` : ''}${s}</span>`;

  // link icons: GitHub mark (Primer Octicons, MIT) and a note glyph for the blog
  const IC_GH = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>';
  const IC_BLOG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill-rule="evenodd" d="M3.75 1h8.5c.97 0 1.75.78 1.75 1.75v10.5c0 .97-.78 1.75-1.75 1.75h-8.5C2.78 15 2 14.22 2 13.25V2.75C2 1.78 2.78 1 3.75 1Zm1 3.25a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5Zm0 3a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5Zm0 3a.75.75 0 0 0 0 1.5h4a.75.75 0 0 0 0-1.5Z"/></svg>';

  // the full-page capture sits in the middle and scrolls inside its window; other screens
  // (never the main page) drift past on both sides, each side its own set, doubled so it can loop
  const SHOTS = { mini1: 8, mini2: 8, mini3: 7, onde: 8, argus: 6, canary: 7, patience: 6 };
  const img = (id, f) => `assets/images/${P[id].dir || 'rookies'}/${id}-${f}.webp`;
  const win = (src, cls = '') => `<div class="win ${cls}"><i></i><img data-src="${src}" alt=""></div>`;
  const side = (id, col, dir) => `<div class="wall__col wall__col--${dir}">${[...col, ...col].map(n => win(img(id, `s${n}`))).join('')}</div>`;
  const wall = (id, name) => { const all = Array.from({ length: SHOTS[id] }, (_, k) => k + 1), half = Math.ceil(all.length / 2);
    return `<div class="wall" role="img" aria-label="${name} 화면"><div class="wall__plane">
    ${side(id, all.slice(0, half), 'up')}<div class="wall__hero">${win(img(id, 'full'), 'win--page')}</div>${side(id, all.slice(half), 'down')}</div></div>`; };

  const project = id => { const p = P[id];
    return `<article class="rkp" id="${P[id].dir ? "ps" : "rk"}-${id}" style="--c:${p.c}">
      <header class="rkp__hd"><span class="rkp__no">${p.no}</span>
        <div><span class="rkp__tag">${p.tag}<em>${p.days}일 · ${p.team}명</em></span><h3>${p.name}</h3><p>${p.sub}</p></div>
        <nav class="rkp__links"><a href="${GH}${p.repo}" target="_blank" rel="noopener noreferrer">${IC_GH}GitHub</a><a href="${BLOG}${p.post}/" target="_blank" rel="noopener noreferrer">${IC_BLOG}Blog</a></nav></header>
      ${wall(id, p.name)}
      <div class="rkp__story"><h4>${p.kicker}</h4><p>${p.lede.map(l => `<span>${l}</span>`).join('')}</p>
        <ol class="rkp__flow ${p.pipe ? 'rkp__flow--pipe' : ''}" style="--n:${p.flow.length}">${p.flow.map(([t, d]) => `<li><b>${t}</b><span>${d}</span></li>`).join('')}</ol></div>
      <div class="rkp__grid">
        <section><h4>담당</h4><ul class="rkp__roles">${p.role.map(([t, v]) =>
          `<li><i style="--v:${v}"><b>${v}</b></i><span>${t}</span></li>`).join('')}</ul></section>
        <section><h4>개발 환경</h4><dl class="rkp__env">${p.env.map(([k, list]) =>
          `<div><dt>${k}</dt><dd>${list.map(badge).join('')}</dd></div>`).join('')}</dl></section>
      </div>
      <section class="rkp__key"><h4>핵심 구현</h4><p class="rkp__why">${p.why.lede}</p>
        <div class="rkp__tabs" role="tablist">${p.points.map(([t, d], k) =>
          `<button class="rkp__tab" type="button" role="tab" aria-selected="${k === 0}" data-k="${k}"><b><em>0${k + 1}</em>${t}</b><p>${d}</p></button>`).join('')}</div>
        ${p.why.items.map((it, k) => `<div class="rkp__panel" role="tabpanel" data-k="${k}" ${k ? 'hidden' : ''}>
          <h5>${it.title}</h5>${it.intro.map(x => `<p>${x}</p>`).join('')}<p class="rkp__flowline">${(it.flow || p.points[k][2]).split(' → ').join('<i>→</i>')}</p>
          <table><thead><tr><th scope="col">${it.head[0]}</th><th scope="col">${it.head[1]}</th></tr></thead>
            <tbody>${it.rows.map(([a, b]) => `<tr><th scope="row">${a}</th><td>${b}</td></tr>`).join('')}</tbody></table></div>`).join('')}
      </section>
      </article>`; };

  // table of contents: one card per project, showing the top of its main page
  const node = (id, tag) => { const p = P[id]; return `<a class="rk-card" href="#${P[id].dir ? 'ps' : 'rk'}-${id}" style="--c:${p.c}">`
    + `<span class="rk-card__img"><img data-src="${img(id, 'full')}" alt=""></span>`
    + `<span class="rk-card__body"><b><em>${p.no}</em>${tag}</b><strong>${p.name}</strong><small>${p.days}일 · ${p.team}명</small></span></a>`; };

  root.innerHTML = `
    <header class="rk-head">
      <p class="rx-kicker">SK Shieldus Rookies 5기</p>
      <h2>지능형 애플리케이션 개발자 양성과정</h2>
      <p class="rk-head__meta">2026.02 – 2026.07 · 미니 프로젝트 3 · 최종 프로젝트 2</p>
      <nav class="rk-line">
        <div class="rk-group rk-group--3"><span class="rk-group__lab">MINI</span>${node('mini1', 'MINI 1')}${node('mini2', 'MINI 2')}${node('mini3', 'MINI 3')}</div>
        <div class="rk-group rk-group--2"><span class="rk-group__lab">FINAL</span>${node('onde', 'TARGET')}${node('argus', 'DIAGNOSTICS')}</div></nav>
    </header>
    ${project('mini1')}${project('mini2')}${project('mini3')}
    <section class="rkf" id="rk-final">
      <header class="rkf__hd"><span class="rkp__no">04</span><div><span class="rkp__tag">FINAL<em>2개 프로젝트</em></span>
        <h3>클라우드 구축을 통한 취약점 진단 및 모의해킹</h3>
        <p>바이브 코딩 과정에서 드러난 취약점과, 그것을 가려내는 플랫폼.</p></div></header>
      <ol class="rkf__why">${[
        ['01', '속도', '바이브 코딩', '개발 속도를 극적으로 끌어올리는 강력한 코딩 방법입니다.', '#e3b341'],
        ['02', '착각', '편하지만 안전하지 않다', '컴파일을 통과하고 정상 동작한다고 취약점이 없는 것은 아닙니다.', '#f78166'],
        ['03', '필수', '취약점 진단', '그래서 진단은 선택이 아니라 필수입니다.', '#f85149'],
        ['04', '실증', '타겟 플랫폼 × 진단 플랫폼', '바이브 코딩으로 타깃을 만들고, 사람이 직접 확인한 수동 진단과 만든 플랫폼으로 돌린 자동 진단을 비교했습니다.', '#4493f8'],
      ].map(([n, k, t, d, c]) => `<li style="--c:${c}"><span><em>${n}</em>${k}</span><b>${t}</b><p>${d}</p></li>`).join('')}</ol>
      <div class="rkf__pair">
        <a class="o" href="#rk-onde"><small>TARGET</small><b>ONDE</b><span>바이브 코딩으로 만든 여행 플랫폼 · 취약점 진단의 대상</span></a>
        <div class="rkf__arrow"><small>수동 진단 · 사람이 직접 확인</small>
          <svg viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true"><path d="M196 10 H6" /><path class="tip" d="M14 3 L4 10 L14 17" /></svg>
          <small>자동 진단 · ARGUS 모듈 → 두 결과 비교</small></div>
        <a class="a" href="#rk-argus"><small>DIAGNOSTICS</small><b>ARGUS</b><span>URL·API 명세로 돌리는 통합 진단 플랫폼 · 취약점 진단기</span></a></div>
      ${project('onde')}${project('argus')}
    </section>`;

  const MINIS = [["Shorts Alert", "숏폼 시청 시간 모니터 & 알림", "Chrome", "MINI_ShortsAlert", "mini-shorts-alert"], ["Repeat Music Player", "구간 반복 재생 · 오디오 병합", "Desktop", "MINI_RepeatMusicPlayer", "mini-repeat-music-player"], ["Image Zoomer", "픽셀 이미지 정밀 확대 뷰어", "Desktop", "MINI_ImageZoomer", "mini-image-zoomer"], ["Monitor Coordinate System", "모니터 좌표 · 거리 측정 유틸", "Desktop", "MINI_MonitorCoordinateSystem", "mini-monitor-coordinate-system"], ["Image Converter", "이미지 일괄 변환 · 최적화", "Desktop", "MINI_ImageConverter", "mini-image-converter"], ["Color Picker", "픽셀 돋보기 · 색상 피커", "Desktop", "MINI_ColorPicker", "mini-color-picker"], ["Web Score Board", "보드게임용 웹 스코어보드", "Web", "MINI_WebScoreBoard", "mini-web-score-board"]];
  proot.innerHTML = `
    <header class="rk-head">
      <p class="rx-kicker">Personal</p>
      <h2>혼자 기획하고 끝까지 만든 프로젝트</h2>
      <p class="rk-head__meta">개인 프로젝트 2 · 미니 프로젝트 ${MINIS.length}</p>
      <nav class="rk-line rk-line--ps">
        <div class="rk-group rk-group--2"><span class="rk-group__lab">PERSONAL</span>${node('canary', 'WEB')}${node('patience', 'WEB')}</div>
        <div class="rk-group ps-minis"><span class="rk-group__lab">MINI</span>${MINIS.map(([n, d, kind, repo, post]) =>
          `<div class="ps-mini" data-kind="${kind.toLowerCase()}"><span class="ps-kind">${kind}</span><b>${n}</b><span class="ps-desc">${d}</span><nav>`
          + `<a href="${GH}${repo}" target="_blank" rel="noopener noreferrer" title="GitHub" aria-label="${n} GitHub">${IC_GH}</a>`
          + `<a href="${BLOG}${post}/" target="_blank" rel="noopener noreferrer" title="Blog" aria-label="${n} Blog">${IC_BLOG}</a></nav></div>`).join('')}</div></nav>
    </header>
    ${project('canary')}${project('patience')}`;

  // screens load all at once when the tab first opens (or quietly after the page settles),
  // so the tilted walls never show half-empty windows the way lazy loading would
  const load = r => r.querySelectorAll('img[data-src]').forEach(el => { el.src = el.dataset.src; el.removeAttribute('data-src'); });
  [[root, 'rk'], [proot, 'ps']].forEach(([r, tab]) => {
    document.querySelector(`.tab[data-p=${tab}]`)?.addEventListener('click', () => load(r));
    addEventListener('load', () => setTimeout(() => load(r), 1500));
    if (!r.closest('.panel').hidden) load(r);
  });

  // key implementations: the three cards act as tabs for the detail panel underneath
  [root, proot].forEach(r => r.addEventListener('click', e => {
    const tab = e.target.closest('.rkp__tab'); if (!tab) return;
    const sec = tab.closest('.rkp__key');
    sec.querySelectorAll('.rkp__tab').forEach(t => t.setAttribute('aria-selected', t === tab));
    sec.querySelectorAll('.rkp__panel').forEach(pn => pn.hidden = pn.dataset.k !== tab.dataset.k);
  }));

  [...root.querySelectorAll('.rk-line a, .rkf__pair a'), ...proot.querySelectorAll('.rk-card')].forEach(a => a.addEventListener('click', e => {
    e.preventDefault(); document.querySelector(a.getAttribute('href')).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
})();

/* ---------- Overview: career journey, drawn like the background one and running up to this month ---------- */
(() => {
  const board = document.querySelector('[data-career-board]');
  if (!board) return;
  // start / end as 'YYYY-MM'; an empty end means still there
  const CAREER = [{ name: 'DX Solutions', team: '제조AX팀', start: '2026-09', end: null }];
  const ym = s => { const [y, m] = s.split('-').map(Number); return y * 12 + m - 1; };
  const fmt = n => `${Math.floor(n / 12)}.${String(n % 12 + 1).padStart(2, '0')}`;
  const now = new Date(), cur = now.getFullYear() * 12 + now.getMonth();
  const today = cur + (now.getDate() - 1) / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();   // "now" inside this month
  const from = Math.min(...CAREER.map(c => ym(c.start)));
  const to = cur + 2, span = to - from;              // the axis runs to the end of next month
  const pct = n => ((n - from) / span * 100).toFixed(3);
  const bars = CAREER.map(c => { const a = ym(c.start), b = c.end ? ym(c.end) + 1 : today, range = `${fmt(a)} ~ ${c.end ? fmt(ym(c.end)) : '현재'}`;
    return `<div class="jm jm--work ${c.end ? '' : 'jm--open'}" style="--l:${pct(a)}%;--w:${(pct(b) - pct(a)).toFixed(3)}%" title="${c.name} · ${range}">
      <span class="jm__label">${c.name}<span class="jm__range">${range}</span></span><span class="jm__bar"></span></div>`; }).join('');
  // ticks: months for the first year and a half, then quarters, then years
  const step = span <= 18 ? 1 : span <= 48 ? 3 : 12;
  const ticks = [];
  for (let n = from; n < to; n++) if ((n - from) % step === 0 && Math.abs(n - today) > .45) ticks.push(`<span style="left:${pct(n)}%">${n % 12 === 0 || n === from ? fmt(n) : String(n % 12 + 1).padStart(2, '0')}</span>`);
  board.innerHTML = bars + `<div class="pb-years" aria-hidden="true">${ticks.join('')}<span class="pb-years__end" style="left:${pct(today)}%">현재</span></div>`;
  const start = CAREER[0].start;
  document.querySelector('[data-career-range]').textContent = `${fmt(ym(start))} - 현재`;
})();
