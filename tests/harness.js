/* Pull named functions out of the app's index.html and make them callable,
   so tests exercise the shipped source instead of a hand-copied duplicate.

   This matters: an earlier test in this project re-implemented the function
   it was testing, so it asserted a copy and would have passed while the
   shipped code was broken.

   Extraction is by brace matching from `function NAME(` to its closing brace. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* The canonical file is the one being edited; the repo copy is synced to it
   at release time. Read the canonical when it is present so a test can never
   quietly pass against a stale copy. Override with SAHKAR_APP if needed. */
const CANONICAL = 'D:\\Guru\\Mirror\\CRITICAL FILES\\Claude Apps\\Partnership Dashboard\\index.html';
const REPO_COPY = path.join(__dirname, '..', 'index.html');
const APP = process.env.SAHKAR_APP
  || (fs.existsSync(CANONICAL) ? CANONICAL : REPO_COPY);

function extract(src, name){
  const start = src.search(new RegExp('function\\s+' + name + '\\s*\\('));
  if(start === -1) return null;
  const open = src.indexOf('{', start);
  if(open === -1) return null;
  let depth = 0, inStr = null, prev = '';
  for(let i = open; i < src.length; i++){
    const c = src[i];
    if(inStr){
      if(c === inStr && prev !== '\\') inStr = null;
    } else if(c === '"' || c === "'" || c === '`'){
      inStr = c;
    } else if(c === '{'){
      depth++;
    } else if(c === '}'){
      depth--;
      if(depth === 0) return src.slice(start, i + 1);
    }
    prev = c;
  }
  return null;
}

function loadFns(names, globals){
  const src = fs.readFileSync(APP, 'utf8');
  const missing = [], bodies = [];
  for(const n of names){
    const body = extract(src, n);
    if(!body) missing.push(n); else bodies.push(body);
  }
  if(missing.length) throw new Error('index.html has no function(s): ' + missing.join(', '));

  const sandbox = Object.assign({ console }, globals);
  vm.createContext(sandbox);
  vm.runInContext(bodies.join('\n\n'), sandbox);

  const out = {};
  for(const n of names) out[n] = sandbox[n];
  return out;
}

module.exports = { loadFns, extract };
