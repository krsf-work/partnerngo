/* Extract the app's main <script> block BY SIZE and syntax-check it.

   Selecting by line offset silently checks a different, tiny inline script
   and reports success on broken code — that happened in this project and let
   a real SyntaxError ship. Size selection is the fix; the >100000 floor is
   the guard that proves the extraction found the real thing. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CANONICAL = 'D:\\Guru\\Mirror\\CRITICAL FILES\\Claude Apps\\Partnership Dashboard\\index.html';
const REPO_COPY = path.join(__dirname, '..', 'index.html');
const APP = process.env.SAHKAR_APP
  || (fs.existsSync(CANONICAL) ? CANONICAL : REPO_COPY);

const src = fs.readFileSync(APP, 'utf8');
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
let best = '', m;
while((m = re.exec(src)) !== null){ if(m[1].length > best.length) best = m[1]; }

if(best.length < 100000){
  console.error(`FAIL: largest inline script is only ${best.length} chars — expected >100000. Extraction is wrong.`);
  process.exit(1);
}
try{
  new vm.Script(best);
  console.log(`syntax OK (${best.length} chars)`);
}catch(e){
  console.error('SYNTAX ERROR:', e.message);
  process.exit(1);
}
