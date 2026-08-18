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

/* Walk from `from`, tracking string literals, until the nesting depth
   returns to zero at `closer` (for a function body) or a `;` is reached at
   depth zero (for a const declaration). Returns the end index, or -1. */
function scan(src, from, mode){
  let depth = 0, inStr = null, prev = '';
  for(let i = from; i < src.length; i++){
    const c = src[i];
    if(inStr){
      if(c === inStr && prev !== '\\') inStr = null;
    } else if(c === '"' || c === "'" || c === '`'){
      inStr = c;
    } else if(c === '{' || c === '[' || c === '('){
      depth++;
    } else if(c === '}' || c === ']' || c === ')'){
      depth--;
      if(mode === 'braces' && depth === 0) return i;
    } else if(mode === 'semicolon' && c === ';' && depth === 0){
      return i;
    }
    prev = c;
  }
  return -1;
}

function extract(src, name){
  /* a function declaration */
  const fnStart = src.search(new RegExp('function\\s+' + name + '\\s*\\('));
  if(fnStart !== -1){
    const open = src.indexOf('{', fnStart);
    if(open !== -1){
      const end = scan(src, open, 'braces');
      if(end !== -1) return src.slice(fnStart, end + 1);
    }
  }
  /* A top-level const/let lookup table the functions depend on. Rewrite the
     keyword to `var`: const and let create lexical bindings that never become
     properties of the sandbox object, so the caller would get undefined back
     even though the declaration ran fine. */
  const cRe = new RegExp('^(?:const|let|var)\\s+' + name + '\\s*=', 'm');
  const cm = cRe.exec(src);
  if(cm){
    const end = scan(src, cm.index, 'semicolon');
    if(end !== -1) return src.slice(cm.index, end + 1).replace(/^(?:const|let)\s/, 'var ');
  }
  return null;
}

/* NOTE for test authors: values constructed INSIDE an extracted function —
   an `[]` or `{}` literal, for instance — belong to the sandbox's realm, so
   their prototype is not this file's Array.prototype. assert.deepStrictEqual
   compares prototypes and will reject even two empty arrays. Convert first,
   e.g. Array.from(result, r => r.id), before comparing. Values that merely
   pass THROUGH a function (because .filter() was called on an array you
   supplied) keep this realm and compare fine — which is why the mistake
   hides until an empty result shows up. */
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
