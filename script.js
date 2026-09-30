/* Quiz engine. Reads window.QUESTION_BANK; contains no question content. */
(() => {
  'use strict';
  const CFG = Object.assign({ title: 'Quiz', expectedTotal: null }, window.QUIZ_CONFIG);
  const BANK = (window.QUESTION_BANK || []).slice().sort((a, b) => a.id - b.id); // copy: original never mutated
  const app = document.getElementById('app');
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const keysOf = q => Object.keys(q.options || {});
  let S = null; // {mode, list, idx, answers:{id:letter}}

  /* ---------- validation ---------- */
  function validate() {
    const seen = new Map(), dup = [], noAns = [], badAns = [], noOpts = [], gaps = [];
    BANK.forEach(q => {
      seen.set(q.id, (seen.get(q.id) || 0) + 1);
      if (!q.answer) noAns.push(q.id);
      else if (!q.options || !(q.answer in q.options)) badAns.push(q.id);
      if (keysOf(q).length < 2) noOpts.push(q.id);
    });
    seen.forEach((n, id) => n > 1 && dup.push(id));
    const max = Math.max(0, ...BANK.map(q => q.id));
    for (let i = 1; i <= max; i++) if (!seen.has(i)) gaps.push(i);
    const total = seen.size;
    const ok = !dup.length && !noAns.length && !badAns.length && !noOpts.length && !gaps.length &&
      (!CFG.expectedTotal || total === CFG.expectedTotal);
    return { total, withAns: BANK.length - noAns.length, noAns, dup, badAns, noOpts, gaps, ok };
  }

  /* ---------- helpers ---------- */
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const start = (mode, list) => {
    if (!list.length) return alert('No questions available for that selection.');
    S = { mode, list, idx: 0, answers: {} };
    renderQuestion();
  };
  const isPractice = () => S.mode === 'practice' || S.mode === 'retry-practice';

  /* ---------- menu ---------- */
  function renderMenu() {
    S = null;
    const v = validate();
    const chapters = new Map();
    BANK.forEach(q => { if (q.chapter) { if (!chapters.has(q.chapter)) chapters.set(q.chapter, new Set()); if (q.topic) chapters.get(q.chapter).add(q.topic); } });
    const filters = [];
    chapters.forEach((topics, ch) => {
      filters.push({ label: `${ch} (whole chapter)`, fn: q => q.chapter === ch });
      topics.forEach(t => filters.push({ label: `${ch} › ${t}`, fn: q => q.chapter === ch && q.topic === t }));
    });
    const problems = [
      v.noAns.length && `Missing answers: ${v.noAns.join(', ')}`,
      v.dup.length && `Duplicate IDs: ${v.dup.join(', ')}`,
      v.gaps.length && `Missing question numbers: ${v.gaps.length > 30 ? v.gaps.slice(0, 30).join(', ') + '…' : v.gaps.join(', ')}`,
      v.badAns.length && `Answer not among options: ${v.badAns.join(', ')}`,
      v.noOpts.length && `Too few options: ${v.noOpts.join(', ')}`,
      CFG.expectedTotal && v.total !== CFG.expectedTotal && `Expected ${CFG.expectedTotal} questions, found ${v.total}`
    ].filter(Boolean);

    app.innerHTML = `
      <h1>${esc(CFG.title)}</h1>
      <p class="muted">${BANK.length} questions in the bank</p>
      <section class="panel"><h2>Modes</h2>
        <div class="row">
          <button class="btn primary" data-a="full">Full quiz</button>
          <button class="btn" data-a="practice">Practice mode</button>
        </div>
        <p class="muted small">Full quiz shows the score after you submit. Practice mode gives feedback after each answer.</p>
      </section>
      <section class="panel"><h2>Topic / section</h2>
        <div class="row">
          <select id="topicSel" aria-label="Topic or chapter" ${filters.length ? '' : 'disabled'}>
            ${filters.length ? filters.map((f, i) => `<option value="${i}">${esc(f.label)}</option>`).join('') : '<option>No chapter/topic data</option>'}
          </select>
          <button class="btn" data-a="topic" ${filters.length ? '' : 'disabled'}>Start</button>
        </div>
      </section>
      <section class="panel"><h2>Random quiz</h2>
        <div class="row">
          <select id="randSel" aria-label="Number of questions">
            ${[10, 20, 30, 50].map(n => `<option value="${n}">${n} questions</option>`).join('')}
          </select>
          <button class="btn" data-a="random">Start</button>
        </div>
      </section>
      <details class="panel"><summary>Data validation ${v.ok ? '✔' : '⚠'}</summary>
        <pre>Total questions: ${v.total}${CFG.expectedTotal ? ` (expected ${CFG.expectedTotal})` : ''}
Questions with answers: ${v.withAns}
Missing answers: ${v.noAns.length}
Duplicate IDs: ${v.dup.length}
Missing numbers: ${v.gaps.length}</pre>
        ${problems.length ? `<ul class="warn">${problems.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : '<p>No problems found.</p>'}
      </details>`;
    app.onclick = e => {
      const a = e.target.dataset.a; if (!a) return;
      if (a === 'full') start('full', BANK);
      if (a === 'practice') start('practice', BANK);
      if (a === 'topic') start('topic', BANK.filter(filters[+document.getElementById('topicSel').value].fn));
      if (a === 'random') start('random', shuffle(BANK).slice(0, +document.getElementById('randSel').value));
    };
  }

  /* ---------- question screen (renders one question only) ---------- */
  function renderQuestion() {
    const { list, idx, answers } = S, q = list[idx], n = list.length;
    const chosen = answers[q.id], locked = isPractice() && chosen;
    const answered = Object.keys(answers).length;
    const last = idx === n - 1;
    app.innerHTML = `
      <header class="top">
        <button class="link" data-a="menu">← Menu</button>
        <span class="muted">${answered} of ${n} answered</span>
      </header>
      <div class="qhead"><strong>Question ${idx + 1} of ${n}</strong>${n !== BANK.length || q.id !== idx + 1 ? `<span class="muted small">Bank no. ${q.id}</span>` : ''}</div>
      <div class="bar" role="progressbar" aria-valuemin="1" aria-valuemax="${n}" aria-valuenow="${idx + 1}"><i style="width:${((idx + 1) / n) * 100}%"></i></div>
      ${q.topic ? `<p class="muted small">${esc(q.chapter || '')}${q.chapter && q.topic ? ' › ' : ''}${esc(q.topic)}</p>` : ''}
      <h2 class="qtext">${esc(q.question)}</h2>
      <div class="opts" role="radiogroup" aria-label="Answer choices">
        ${keysOf(q).map(k => {
          let cls = 'opt';
          if (chosen === k) cls += ' sel';
          if (locked) { if (k === q.answer) cls += ' right'; else if (k === chosen) cls += ' wrong'; }
          return `<button class="${cls}" role="radio" aria-checked="${chosen === k}" data-k="${k}" ${locked ? 'disabled' : ''}><b>${esc(k)}</b><span>${esc(q.options[k])}</span></button>`;
        }).join('')}
      </div>
      ${locked ? `<div class="fb ${chosen === q.answer ? 'ok' : 'no'}"><strong>${chosen === q.answer ? 'Correct.' : `Incorrect. The correct answer is ${esc(q.answer)}.`}</strong>${q.explanation ? `<p>${esc(q.explanation)}</p>` : ''}</div>` : ''}
      <nav class="nav">
        <button class="btn" data-a="prev" ${idx === 0 ? 'disabled' : ''}>Previous</button>
        <label class="jump">Go to <input id="jump" type="number" min="1" max="${n}" value="${idx + 1}"><button class="btn small" data-a="go">Go</button></label>
        ${last ? '<button class="btn primary" data-a="submit">Submit</button>' : '<button class="btn primary" data-a="next">Next</button>'}
      </nav>`;
    app.onclick = e => {
      const opt = e.target.closest('.opt'); if (opt) return pick(opt.dataset.k);
      const a = e.target.dataset.a; if (!a) return;
      if (a === 'prev') go(idx - 1);
      if (a === 'next') go(idx + 1);
      if (a === 'go') go((+document.getElementById('jump').value || 1) - 1);
      if (a === 'submit') submit();
      if (a === 'menu' && confirm('Leave this quiz? Your answers will be lost.')) renderMenu();
    };
    document.getElementById('jump').onkeydown = e => { if (e.key === 'Enter') go((+e.target.value || 1) - 1); };
  }
  function go(i) { S.idx = Math.min(Math.max(i, 0), S.list.length - 1); renderQuestion(); }
  function pick(k) {
    const q = S.list[S.idx];
    if (isPractice() && S.answers[q.id]) return;
    S.answers[q.id] = k;
    renderQuestion();
    const sel = app.querySelector('.opt.sel'); if (sel && !sel.disabled) sel.focus();
  }
  function submit() {
    const left = S.list.length - Object.keys(S.answers).length;
    if (left && !confirm(`${left} question(s) are unanswered. Submit anyway?`)) return;
    renderResults();
  }

  /* ---------- results ---------- */
  function renderResults() {
    const { list, answers } = S;
    let correct = 0, wrong = 0;
    const rows = list.map((q, i) => {
      const a = answers[q.id];
      const st = !a ? 'skip' : a === q.answer ? 'right' : 'wrong';
      if (st === 'right') correct++; else if (st === 'wrong') wrong++;
      return `<article class="rv ${st}">
        <p><strong>${i + 1}.</strong> ${esc(q.question)} <span class="tag ${st}">${st === 'right' ? 'Correct' : st === 'wrong' ? 'Incorrect' : 'Unanswered'}</span></p>
        <p class="small">Your answer: ${a ? `${esc(a)}. ${esc(q.options[a])}` : '—'}<br>Correct answer: ${esc(q.answer)}. ${esc(q.options[q.answer])}</p>
        ${q.explanation ? `<p class="small muted">${esc(q.explanation)}</p>` : ''}</article>`;
    });
    const total = list.length, attempted = correct + wrong, pct = total ? ((correct / total) * 100).toFixed(1) : '0.0';
    const wrongIds = list.filter(q => answers[q.id] && answers[q.id] !== q.answer);
    app.innerHTML = `
      <h1>Results</h1>
      <div class="score"><span>${pct}%</span><small>${correct} of ${total} correct</small></div>
      <dl class="stats">
        <div><dt>Total</dt><dd>${total}</dd></div><div><dt>Attempted</dt><dd>${attempted}</dd></div>
        <div><dt>Correct</dt><dd>${correct}</dd></div><div><dt>Incorrect</dt><dd>${wrong}</dd></div>
        <div><dt>Unanswered</dt><dd>${total - attempted}</dd></div>
      </dl>
      <div class="row">
        <button class="btn" data-a="restart">Restart this quiz</button>
        <button class="btn" data-a="retry" ${wrongIds.length ? '' : 'disabled'}>Retry incorrect (${wrongIds.length})</button>
        <button class="btn" data-a="full">Retake full quiz</button>
        <button class="btn" data-a="random">New random quiz</button>
        <button class="btn" data-a="menu">Menu</button>
      </div>
      <h2>Review</h2>
      <div class="row filters">
        <button class="btn small" data-f="all">All</button><button class="btn small" data-f="wrong">Incorrect</button><button class="btn small" data-f="skip">Unanswered</button>
      </div>
      <div id="review" data-f="all">${rows.join('')}</div>`;
    const mode = S.mode;
    app.onclick = e => {
      const f = e.target.dataset.f; if (f) return (document.getElementById('review').dataset.f = f);
      const a = e.target.dataset.a; if (!a) return;
      if (a === 'restart') start(mode, mode === 'random' ? list : list);
      if (a === 'retry') start(mode === 'full' ? 'retry-practice' : mode, wrongIds);
      if (a === 'full') start('full', BANK);
      if (a === 'random') start('random', shuffle(BANK).slice(0, Math.min(20, BANK.length)));
      if (a === 'menu') renderMenu();
    };
  }

  /* ---------- keyboard ---------- */
  document.addEventListener('keydown', e => {
    if (!S || !document.querySelector('.opts') || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight') go(S.idx + 1);
    else if (e.key === 'ArrowLeft') go(S.idx - 1);
    else {
      const q = S.list[S.idx], ks = keysOf(q);
      const k = /^[1-9]$/.test(e.key) ? ks[+e.key - 1] : ks.find(x => x.toLowerCase() === e.key.toLowerCase());
      if (k && !e.ctrlKey && !e.metaKey) pick(k);
    }
  });

  renderMenu();
})();
