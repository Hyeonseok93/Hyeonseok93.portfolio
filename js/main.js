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
  const select = t => {
    tabs.forEach(x => x.setAttribute('aria-selected', x === t));
    document.querySelectorAll('.panel').forEach(p => p.hidden = p.id !== t.dataset.p);
    cur.textContent = label(t);
  };
  tabs.forEach(t => t.addEventListener('click', () => {
    select(t);
    if (narrow.matches) { setMenu(false); scrollTo({ top: 0 }); }
  }));
  menuBtn.addEventListener('click', () => setMenu(!document.body.classList.contains('nav-open')));
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

/* ---------- Rookies tab: five projects on one page, each with a tilted wall of screens ---------- */
(() => {
  const root = document.querySelector('[data-rk]');
  if (!root) return;
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
      env: [["언어", ["TypeScript", "Python"]], ["프레임워크", ["React", "FastAPI"]], ["진단", ["OWASP ZAP", "Playwright", "httpx"]], ["인프라", ["Docker", "Nginx", "Terraform", "AWS"]], ["빌드", ["Vite", "GitHub Actions"]], ["라이브러리", ["Tailwind CSS", "Lucide", "Pydantic", "ReportLab", "PyYAML"]]],
      repo: 'SK-Rookies5-FINAL_ARGUS', post: 'rookies-showcase-final2' },
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
    Lucide: 'lucide.svg', Pydantic: 'pydantic.svg', ReportLab: 'reportlab.svg', PyYAML: 'pyyaml.svg' };
  const badge = s => `<span class="tech">${ICON[s] ? `<img src="assets/icons/stack/${ICON[s]}" alt="">` : ''}${s}</span>`;

  // link icons: GitHub mark (Primer Octicons, MIT) and a note glyph for the blog
  const IC_GH = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>';
  const IC_BLOG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill-rule="evenodd" d="M3.75 1h8.5c.97 0 1.75.78 1.75 1.75v10.5c0 .97-.78 1.75-1.75 1.75h-8.5C2.78 15 2 14.22 2 13.25V2.75C2 1.78 2.78 1 3.75 1Zm1 3.25a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5Zm0 3a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5Zm0 3a.75.75 0 0 0 0 1.5h4a.75.75 0 0 0 0-1.5Z"/></svg>';

  // the full-page capture sits in the middle and scrolls inside its window; other screens
  // (never the main page) drift past on both sides, each side its own set, doubled so it can loop
  const SHOTS = { mini1: 8, mini2: 8, mini3: 7, onde: 8, argus: 6 };
  const win = (src, cls = '') => `<div class="win ${cls}"><i></i><img data-src="assets/images/rookies/${src}.webp" alt=""></div>`;
  const side = (id, col, dir) => `<div class="wall__col wall__col--${dir}">${[...col, ...col].map(n => win(`${id}-s${n}`)).join('')}</div>`;
  const wall = (id, name) => { const all = Array.from({ length: SHOTS[id] }, (_, k) => k + 1), half = Math.ceil(all.length / 2);
    return `<div class="wall" role="img" aria-label="${name} 화면"><div class="wall__plane">
    ${side(id, all.slice(0, half), 'up')}<div class="wall__hero">${win(`${id}-full`, 'win--page')}</div>${side(id, all.slice(half), 'down')}</div></div>`; };

  const project = id => { const p = P[id];
    return `<article class="rkp" id="rk-${id}" style="--c:${p.c}">
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
      <section class="rkp__key"><h4>핵심 구현</h4><ol class="rkp__pts">${p.points.map(([t, d, f], k) =>
        `<li><b><em>0${k + 1}</em>${t}</b><p>${d}</p><code>${f}</code></li>`).join('')}</ol></section>
      </article>`; };

  // table of contents: one card per project, showing the top of its main page
  const node = (id, tag) => { const p = P[id]; return `<a class="rk-card" href="#rk-${id}" style="--c:${p.c}">`
    + `<span class="rk-card__img"><img data-src="assets/images/rookies/${id}-full.webp" alt=""></span>`
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

  // screens load all at once when the tab first opens (or quietly after the page settles),
  // so the tilted walls never show half-empty windows the way lazy loading would
  const load = () => root.querySelectorAll('img[data-src]').forEach(img => { img.src = img.dataset.src; img.removeAttribute('data-src'); });
  document.querySelector('.tab[data-p=rk]')?.addEventListener('click', load);
  addEventListener('load', () => setTimeout(load, 1500));
  if (!root.closest('.panel').hidden) load();

  root.querySelectorAll('.rk-line a, .rkf__pair a').forEach(a => a.addEventListener('click', e => {
    e.preventDefault(); document.querySelector(a.getAttribute('href')).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
})();
