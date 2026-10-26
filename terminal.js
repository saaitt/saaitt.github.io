(() => {
  'use strict';

  const screen = document.getElementById('screen');
  const form = document.getElementById('prompt');
  const input = document.getElementById('cmd');
  const ps1 = document.getElementById('ps1');
  const chips = document.getElementById('chips');

  const THEMES = ['green', 'amber', 'ice', 'paper'];
  const CHIP_COMMANDS = ['about', 'experience', 'skills', 'education', 'contact', 'resume', 'help'];

  let data = null;
  let history = [];
  let histIdx = 0;
  let booting = true;

  // ---------- rendering ----------
  // A line is a string or an array of segments. A segment is a string or
  // {t: text, c: css class, href: url, run: command to execute on click}.
  function seg(s) {
    if (typeof s === 'string') return document.createTextNode(s);
    let node;
    if (s.href) {
      node = document.createElement('a');
      node.href = s.href;
      if (/^https?:/.test(s.href)) { node.target = '_blank'; node.rel = 'noopener noreferrer'; }
    } else if (s.run) {
      node = document.createElement('span');
      node.className = 'cmd-link';
      node.tabIndex = 0;
      node.setAttribute('role', 'button');
      const go = () => runCommand(s.run);
      node.addEventListener('click', go);
      node.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    } else {
      node = document.createElement('span');
    }
    if (s.c) node.classList.add(...s.c.split(' '));
    node.textContent = s.t;
    return node;
  }

  function print(line = '') {
    const div = document.createElement('div');
    div.className = 'line';
    (Array.isArray(line) ? line : [line]).forEach(s => div.appendChild(seg(s)));
    screen.appendChild(div);
    return div;
  }
  const printAll = lines => lines.forEach(print);
  const scrollDown = () => window.scrollTo(0, document.body.scrollHeight);

  const pad = (s, n) => s + ' '.repeat(Math.max(1, n - s.length));
  const wrap = (text, width = 78) => {
    const out = [];
    let cur = '';
    for (const w of text.split(' ')) {
      if ((cur + ' ' + w).trim().length > width) { out.push(cur); cur = w; }
      else cur = (cur + ' ' + w).trim();
    }
    if (cur) out.push(cur);
    return out;
  };
  const h = title => [{ t: '## ' + title, c: 'accent bold' }];

  // 5x5 block font for the headline banner.
  const GLYPHS = {
    S: [' ####', '#    ', ' ### ', '    #', '#### '],
    A: [' ### ', '#   #', '#####', '#   #', '#   #'],
    E: ['#####', '#    ', '#### ', '#    ', '#####'],
    D: ['#### ', '#   #', '#   #', '#   #', '#### '],
    F: ['#####', '#    ', '#### ', '#    ', '#    '],
    I: ['#####', '  #  ', '  #  ', '  #  ', '#####'],
    R: ['#### ', '#   #', '#### ', '#  # ', '#   #'],
    O: [' ### ', '#   #', '#   #', '#   #', ' ### '],
    U: ['#   #', '#   #', '#   #', '#   #', ' ### '],
    Z: ['#####', '   # ', '  #  ', ' #   ', '#####'],
    ' ': ['  ', '  ', '  ', '  ', '  '],
  };
  const blockText = word =>
    [0, 1, 2, 3, 4].map(row => [...word.toUpperCase()].map(ch => (GLYPHS[ch] || GLYPHS[' '])[row]).join(' ')).join('\n');

  function printBanner() {
    const pre = document.createElement('pre');
    pre.className = 'banner accent';
    pre.setAttribute('role', 'img');
    pre.setAttribute('aria-label', data.name);
    pre.textContent = data.name.split(' ').map(blockText).join('\n\n');
    screen.appendChild(pre);
    print([{ t: data.title.toUpperCase(), c: 'headline-title bold' }]);
    print({ t: `@ ${data.company} · ${data.location}`, c: 'dim' });
  }

  // ---------- commands ----------
  const commands = {
    help() {
      print(h('Available commands'));
      const rows = [
        ['about', 'who I am'],
        ['experience', 'where I have worked'],
        ['skills', 'what I work with'],
        ['education', 'degrees'],
        ['contact', 'email, LinkedIn, GitHub'],
        ['resume', 'the whole thing, in one go'],
        ['neofetch', 'system info, the Saeed edition'],
        ['theme [name]', 'green | amber | ice | paper'],
        ['history', 'commands you have run'],
        ['clear', 'clear the screen'],
      ];
      rows.forEach(([c, d]) => print([{ t: pad(c, 16), c: 'accent' }, { t: d, c: 'dim' }]));
      print({ t: 'Tip: Tab completes, Up/Down browses history. Everything above is clickable too.', c: 'dim' });
    },

    about() {
      printBanner();
      print();
      data.summary.forEach(p => { wrap(p).forEach(print); print(); });
      print([{ t: 'Languages: ', c: 'dim' }, data.languages.map(l => `${l.name} (${l.level})`).join(', ')]);
    },

    experience() {
      print(h('Experience'));
      data.experience.forEach(job => {
        print();
        print([{ t: job.role, c: 'bold' }, ' @ ', { t: job.company, c: 'accent' }]);
        print({ t: `${job.period} · ${job.location}`, c: 'dim' });
        job.bullets.forEach(b => wrap(b, 76).forEach((l, i) => print((i ? '    ' : '  - ') + l)));
      });
    },

    skills() {
      print(h('Skills'));
      Object.entries(data.skills).forEach(([group, items]) =>
        print([{ t: pad(group, 15), c: 'accent' }, items.join(' · ')]));
    },

    education() {
      print(h('Education'));
      data.education.forEach(e => {
        print([{ t: e.degree, c: 'bold' }, ' - ', { t: e.school, c: 'accent' }]);
        print({ t: e.period, c: 'dim' });
      });
    },

    contact() {
      const c = data.contact;
      print(h('Contact'));
      print([{ t: pad('email', 10), c: 'dim' }, { t: c.email, href: 'mailto:' + c.email }]);
      print([{ t: pad('linkedin', 10), c: 'dim' }, { t: c.linkedin.replace('https://', ''), href: c.linkedin }]);
      print([{ t: pad('github', 10), c: 'dim' }, { t: c.github.replace('https://', ''), href: c.github }]);
    },

    resume() {
      ['about', 'experience', 'skills', 'education', 'contact'].forEach((name, i) => {
        if (i) print();
        commands[name]();
      });
    },

    neofetch() {
      const years = new Date().getFullYear() - 2017;
      const rows = [
        [`${data.handle}@saaitt.github.io`, 'accent bold'],
        ['-------------------------', 'dim'],
        [`Role:     ${data.title} @ ${data.company}`],
        [`Location: ${data.location}`],
        [`Uptime:   ${years}+ years in production`],
        [`Stack:    ${data.skills.Core.join(', ')}`],
        [`Shell:    saeed-sh (not POSIX, sorry)`],
        [`Theme:    ${document.documentElement.dataset.theme || 'green'}`],
      ];
      rows.forEach(([t, c]) => print(c ? { t, c } : t));
    },

    theme(args) {
      const name = args[0];
      if (!name) {
        print(['Current: ', { t: document.documentElement.dataset.theme || 'green', c: 'accent' }]);
        print(['Available: ', ...THEMES.flatMap((t, i) => [i ? ', ' : '', { t, run: 'theme ' + t }])]);
        return;
      }
      if (!THEMES.includes(name)) { print({ t: `theme: unknown theme '${name}'`, c: 'warn' }); return; }
      setTheme(name);
      print(`Theme set to ${name}.`);
    },

    history() {
      history.forEach((c, i) => print(`${String(i + 1).padStart(3)}  ${c}`));
    },

    clear() { screen.textContent = ''; },

    whoami() { print(`${data.handle}, but you can call me ${data.name.split(' ')[0]}.`); },
    ls() { print(['about  experience  skills  education  contact  resume'].join('')); },
    pwd() { print('/home/' + data.handle); },
    date() { print(new Date().toString()); },
    echo(args) { print(args.join(' ')); },
    sudo(args) {
      if (args.join(' ') === 'hire-me') {
        print({ t: '[sudo] password for visitor: ********', c: 'dim' });
        print({ t: 'Permission granted. Opening email...', c: 'accent' });
        setTimeout(() => { window.location.href = 'mailto:' + data.contact.email + '?subject=Let%27s%20talk'; }, 700);
      } else {
        print({ t: 'visitor is not in the sudoers file. This incident will be reported.', c: 'warn' });
      }
    },
  };
  commands['about-me'] = commands.about;
  commands.exit =() => print({ t: "There is no escape. Try 'contact' instead.", c: 'dim' });

  function runCommand(raw) {
    const line = raw.trim();
    print([{ t: promptText(), c: 'accent' }, line]);
    if (line) {
      if (history[history.length - 1] !== line) history.push(line);
      const [name, ...args] = line.split(/\s+/);
      const fn = Object.prototype.hasOwnProperty.call(commands, name.toLowerCase()) ? commands[name.toLowerCase()] : null;
      if (fn) fn(args);
      else print([{ t: `command not found: ${name}. Try `, c: 'warn' }, { t: 'help', run: 'help' }, { t: '.', c: 'warn' }]);
    }
    histIdx = history.length;
    input.value = '';
    scrollDown();
  }

  // ---------- input ----------
  const promptText = () => `${data ? data.handle : 'visitor'}@saaitt:~$`;

  function complete() {
    const parts = input.value.split(/\s+/);
    const pool = parts.length > 1 && parts[0] === 'theme' ? THEMES : Object.keys(commands);
    const prefix = parts[parts.length - 1];
    const hits = pool.filter(c => c.startsWith(prefix));
    if (hits.length === 1) {
      parts[parts.length - 1] = hits[0];
      input.value = parts.join(' ') + ' ';
    } else if (hits.length > 1) {
      print({ t: hits.join('  '), c: 'dim' });
    }
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (booting) return;
    runCommand(input.value);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Tab') { e.preventDefault(); if (!booting) complete(); }
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (histIdx > 0) input.value = history[--histIdx];
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      histIdx = Math.min(histIdx + 1, history.length);
      input.value = history[histIdx] || '';
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      commands.clear();
    }
  });

  // Focus the input on click, but not when the user is selecting text or hitting a link.
  document.addEventListener('click', e => {
    if (e.target.closest('a, button, .cmd-link')) return;
    if (String(window.getSelection())) return;
    input.focus({ preventScroll: true });
  });

  // ---------- theme ----------
  function setTheme(name) {
    document.documentElement.dataset.theme = name;
    try { localStorage.setItem('theme', name); } catch (_) { /* storage may be unavailable */ }
  }
  try {
    const saved = localStorage.getItem('theme');
    if (THEMES.includes(saved)) document.documentElement.dataset.theme = saved;
  } catch (_) { /* ignore */ }

  // ---------- boot ----------
  function buildChips() {
    CHIP_COMMANDS.forEach(name => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = name;
      b.addEventListener('click', () => { if (!booting) { runCommand(name); input.focus({ preventScroll: true }); } });
      chips.appendChild(b);
    });
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function boot() {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let skip = reduced;
    const skipNow = () => { skip = true; };
    document.addEventListener('keydown', skipNow, { once: true });
    document.addEventListener('pointerdown', skipNow, { once: true });

    const steps = [
      ['[ ok ] loading resume.json', 'dim'],
      [`[ ok ] mounting experience (${data.experience.length} entries)`, 'dim'],
      ['[ ok ] warming caches', 'dim'],
    ];
    for (const [t, c] of steps) {
      print({ t, c });
      if (!skip) await sleep(260);
    }
    print();
    printBanner();
    print();
    print([{ t: "Type 'help' or tap a command below. Try ", c: 'dim' }, { t: 'about-me', run: 'about-me' }, { t: '.', c: 'dim' }]);
    print();
    booting = false;
    input.disabled = false;
    input.focus({ preventScroll: true });
  }

  async function init() {
    input.disabled = true;
    ps1.textContent = promptText();
    buildChips();
    try {
      const res = await fetch('resume.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status);
      data = await res.json();
    } catch (err) {
      print({ t: 'Failed to load resume.json (' + err.message + '). Reload to retry.', c: 'warn' });
      return;
    }
    ps1.textContent = promptText();
    await boot();
  }

  init();
})();
