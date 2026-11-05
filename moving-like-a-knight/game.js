(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const notice = document.getElementById('notice');
  const soundButton = document.getElementById('sound');
  const W = 1040, H = 700, TILE = 25, ROWS = 25, COLS = 35;
  const imageNames = ['title','settingicon','arrows','midtitle','mouse','instruction','ins_custom','ins_verify','ins_saved_levels','savedlevelscreen','savelevelscreen','resetscreen','victory','gg','ggeasteregg','easteregg','flag','flagins','flagriel','grass_dirt','stone_dirt','grass_ee_dirt','telein','teleout','smalldot','bigdot','hintdot','undo','skillissue','custom_cursor','exiticon','arrowleft','arrowright','defaulthorseyleft','defaulthorseyright','madhorseyleft','madhorseyright'];
  for (const theme of ['grass','stone','grass_ee']) for (let n=0;n<4;n++) imageNames.push(`${theme}_${n}`);
  const images = {};
  for (const name of imageNames) { const image = new Image(); image.src = `assets/images/${name}.png`; image.onload = draw; images[name] = image; }
  const directions = [ [[-1,0],[-2,0],[-2,1]], [[0,1],[-1,1],[-2,1]], [[-1,0],[-1,1],[-1,2]], [[0,1],[0,2],[-1,2]], [[0,1],[0,2],[1,2]], [[1,0],[1,1],[1,2]], [[0,1],[1,1],[2,1]], [[1,0],[2,0],[2,1]], [[1,0],[2,0],[2,-1]], [[0,-1],[1,-1],[2,-1]], [[1,0],[1,-1],[1,-2]], [[0,-1],[0,-2],[1,-2]], [[0,-1],[0,-2],[-1,-2]], [[-1,0],[-1,-1],[-1,-2]], [[0,-1],[-1,-1],[-2,-1]], [[-1,0],[-2,0],[-2,-1]] ];
  const defaults = {level:0, flags:0, points:0, theme:'grass', horse:'default', menuVolume:50, gameVolume:50};
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  let progress = {...defaults, ...read('moving-knight-progress', {})};
  let saved = read('moving-knight-custom', []);
  if (!Array.isArray(saved)) saved = [];
  const persist = () => { try { localStorage.setItem('moving-knight-progress', JSON.stringify(progress)); } catch { showNotice('Browser storage is unavailable.'); } };
  const persistSaved = () => { try { localStorage.setItem('moving-knight-custom', JSON.stringify(saved)); } catch { showNotice('Could not save level in this browser.'); } };
  let screen='title', menuIndex=0, replayIndex=0, moreIndex=0, savedIndex=0, savedPage=0, publicIndex=0;
  let selectedSetting=0, board=null, boardMode='normal', levelNumber=0, bonus=false, flagPos=[0,0], flagged=false, flagHelp=false, hint=null, levelPoint=0, minusPoint=0, lastTick=performance.now(), winImage='gg', editor=null, rename='', resetHold=0, noticeTimer;
  const music = {title:new Audio('assets/music/titlemusic.wav'), game:new Audio('assets/music/nhacvip.wav')};
  music.title.loop = music.game.loop = true;
  const effects = {win:new Audio('assets/music/amthanhchienthang.wav'), move1:new Audio('assets/music/move_1.wav'), move2:new Audio('assets/music/move_2.wav')};
  for (const audio of [...Object.values(music), ...Object.values(effects)]) audio.preload = 'none';
  let soundOn=false, soundChosen=false;
  function updateSoundButton() { soundButton.textContent=soundOn?'♪ Sound on':'♪ Sound off'; soundButton.setAttribute('aria-pressed',String(soundOn)); soundButton.setAttribute('aria-label',soundOn?'Mute game audio':'Unmute game audio'); }
  function activateSound() { if (soundChosen) return; soundChosen=true; soundOn=true; updateSoundButton(); syncAudio(); }
  function volume(which) { return Math.pow(Math.max(0, Math.min(100, progress[which+'Volume']))/100, 2)*0.65; }
  function syncAudio() { music.title.volume=volume('menu'); music.game.volume=volume('game'); for (const effect of Object.values(effects)) effect.volume=volume('game'); if (!soundOn) { music.title.pause(); music.game.pause(); return; } const track = ['title','more','saved','public','custom'].includes(screen) ? 'title' : ['board','victory','reset'].includes(screen) ? 'game' : null; for (const [key, audio] of Object.entries(music)) { if (key === track) audio.play().catch(()=>{}); else audio.pause(); } }
  function playEffect(key) { if (!soundOn) return; const audio=effects[key]; audio.currentTime=0; audio.play().catch(()=>{}); }
  soundButton.addEventListener('click', () => { soundChosen=true; soundOn=!soundOn; updateSoundButton(); syncAudio(); canvas.focus(); });
  function showNotice(text) { notice.textContent=text; notice.classList.add('visible'); clearTimeout(noticeTimer); noticeTimer=setTimeout(()=>notice.classList.remove('visible'),2800); }
  function img(name,x,y,w,h) { const i=images[name]; if (i?.complete && i.naturalWidth) ctx.drawImage(i,x,y,w||i.naturalWidth,h||i.naturalHeight); }
  function text(value,x,y,size=30,color='white',align='left') { ctx.fillStyle=color; ctx.font=`${size}px Shopee, Arial, sans-serif`; ctx.textAlign=align; ctx.fillText(String(value),x,y); ctx.textAlign='left'; }
  function setScreen(next) { screen=next; syncAudio(); draw(); }
  function parseLevel(raw) {
    if (!raw) return null;
    const lines=raw.trim().split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    const [x,y,steps,teleSteps]=lines.shift().split(/\s+/).map(Number);
    const grid=Array.from({length:ROWS},()=>Array(COLS).fill(-1));
    const teles=[]; let tele=false;
    for (const line of lines) { if (line==='tele') { tele=true; continue; } const n=line.split(',').map(Number); if (n.length!==4) continue; if (tele) teles.push({sx:n[0],sy:n[1],ex:n[2],ey:n[3]}); else for(let c=n[1];c<n[2];c++) if (grid[n[0]] && c>=0 && c<COLS) grid[n[0]][c]=n[3]; }
    return {x,y,steps,teleSteps,grid,teles};
  }
  function cloneLevel(level) { return {x:level.x,y:level.y,steps:level.steps,teleSteps:level.teleSteps,grid:level.grid.map(row=>row.slice()),teles:level.teles.map(t=>({...t}))}; }
  function begin(level,mode='normal',number=progress.level,isBonus=false) {
    if (!level) { showNotice('This level is unavailable.'); return; }
    board=cloneLevel(level); boardMode=mode; levelNumber=number; bonus=isBonus; flagged=false; flagHelp=false; hint=null;
    board.turn=0;board.teleTurn=0;board.direction=null;board.history=[];board.flagged=false;
    flagPos=FLAG_POSITIONS[number]||[0,0];
    const point1=number%10||10, point2=Math.ceil(number/10)||1;
    levelPoint=point1*point2*1000+point2*200; minusPoint=1500+500*point2;
    lastTick=performance.now(); setScreen('board'); canvas.focus();
  }
  function loadMain(n=progress.level) { const raw=LEVEL_DATA[String(n)]; if (!raw) { setScreen('victory'); return; } begin(parseLevel(raw),'normal',n); }
  const inBounds=(r,c)=>r>=0&&r<ROWS&&c>=0&&c<COLS;
  function validDirections(b) { const result=[]; for(let d=0;d<16;d++) if(directions[d].every(([dr,dc])=>inBounds(b.x+dr,b.y+dc)&&b.grid[b.x+dr][b.y+dc]>0)) result.push(d); return result; }
  function selectDirection(delta) {
    const available=validDirections(board);
    if (!available.length) { board.direction=null; if(boardMode==='normal'&&!bonus&&Math.random()<.05) { const ids=Object.keys(LEVEL_DATA).filter(n=>Number(n)>=1000); const id=ids[Math.floor(Math.random()*ids.length)]; if(id) begin(parseLevel(LEVEL_DATA[id]),'normal',levelNumber,true); } else showNotice('No valid move. Undo with ←.'); return; }
    if (board.direction===null) board.direction=delta>0 ? available[0] : available[available.length-1];
    else { let index=available.indexOf(board.direction); board.direction=available[(index+delta+available.length)%available.length]; }
  }
  function doMove() {
    if (board.direction===null) { selectDirection(1); return; }
    const d=board.direction, dir=directions[d];
    if (!dir.every(([dr,dc])=>inBounds(board.x+dr,board.y+dc)&&board.grid[board.x+dr][board.y+dc]>0)) { board.direction=null; return; }
    board.history.push({x:board.x,y:board.y,grid:board.grid.map(row=>row.slice()),turn:board.turn,teleTurn:board.teleTurn});
    board.grid[board.x][board.y]--;
    for(let i=0;i<2;i++) board.grid[board.x+dir[i][0]][board.y+dir[i][1]]--;
    board.x+=dir[2][0];board.y+=dir[2][1];board.turn++;board.direction=null;hint=null;
    for(const t of board.teles) if(t.sx===board.x&&t.sy===board.y&&inBounds(t.ex,t.ey)&&board.grid[t.ex][t.ey]>0) { board.grid[t.sx][t.sy]--;board.x=t.ex;board.y=t.ey;board.teleTurn++;break; }
    playEffect(Math.random()<.0075?'move1':'move2');
    if(3*(board.steps-board.turn)+board.teleSteps-board.teleTurn===0) completeLevel();
  }
  function undo() { const prev=board.history.pop(); if(!prev)return; Object.assign(board,prev); board.direction=null;hint=null;draw(); }
  function completeLevel() {
    if(boardMode==='normal') {
      if(bonus) { progress.level=levelNumber+1; progress.flags++; }
      else { if(flagged&&board.x===flagPos[0]&&board.y===flagPos[1]&&Math.random()<.34) progress.flags++; progress.level=levelNumber+1; progress.points+=Math.max(0,Math.floor(levelPoint)); }
      persist();
      if(progress.level>=50) { setScreen('victory'); return; }
      winImage=bonus?'ggeasteregg':Math.random()<.04?'easteregg':'gg';setScreen('win');playEffect('win');
    } else { winImage='gg'; setScreen('win');playEffect('win'); }
  }
  function findHint() {
    if(board.steps-board.turn>21) { hint='overflow'; return; }
    const grid=board.grid.map(row=>row.slice()), memo=new Set(), deadline=performance.now()+400;
    function solve(x,y,steps,teleSteps) {
      if(3*steps+teleSteps===0)return [];
      if(steps<0||teleSteps<0||performance.now()>deadline)return null;
      const key=`${x},${y},${steps},${teleSteps},${grid.map(row=>row.join('')).join('')}`;
      if(memo.has(key))return null;
      for(let d=0;d<16;d++) {
        const dir=directions[d]; if(!dir.every(([dr,dc])=>inBounds(x+dr,y+dc)&&grid[x+dr][y+dc]>0))continue;
        grid[x][y]--;for(let i=0;i<2;i++)grid[x+dir[i][0]][y+dir[i][1]]--;
        let nx=x+dir[2][0],ny=y+dir[2][1],tele=null;
        for(const t of board.teles)if(t.sx===nx&&t.sy===ny&&inBounds(t.ex,t.ey)&&grid[t.ex][t.ey]>0){grid[nx][ny]--;tele=t;nx=t.ex;ny=t.ey;break;}
        const next=solve(nx,ny,steps-1,teleSteps-(tele?1:0));
        if(tele)grid[tele.sx][tele.sy]++;
        grid[x][y]++;for(let i=0;i<2;i++)grid[x+dir[i][0]][y+dir[i][1]]++;
        if(next)return [d,...next];
      }
      memo.add(key);return null;
    }
    const answer=solve(board.x,board.y,board.steps-board.turn,board.teleSteps-board.teleTurn);
    hint=answer?.length?answer[0]:'undo';
    if(hint!=='overflow')levelPoint=Math.max(0,levelPoint-minusPoint);
  }
  function renderBoard() {
    ctx.fillStyle=bonus?'#8034e3':'#8a4f34';ctx.fillRect(0,0,W,H);
    const theme=bonus?'grass_ee':progress.theme;
    img(`${theme}_dirt`,25,25);
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const n=board.grid[r][c];if(n>=0)img(`${theme}_${Math.min(3,n)}`,(c+1)*TILE,(r+1)*TILE);}
    for(let i=0;i<board.teles.length;i++){const t=board.teles[i];img('telein',(t.sy+1)*TILE,(t.sx+1)*TILE);img('teleout',(t.ey+1)*TILE,(t.ex+1)*TILE);text(i+1,(t.sy+1)*TILE+7,(t.sx+2)*TILE-5,18,'black');text(i+1,(t.ey+1)*TILE+7,(t.ex+2)*TILE-5,18,'black');}
    if(flagged)img('flagriel',(flagPos[1]+1)*TILE,(flagPos[0]+1)*TILE);
    img(`${progress.horse}horsey${board.direction!==null&&board.direction>7?'left':'right'}`,(board.y+1)*TILE,(board.x+1)*TILE);
    if(board.direction!==null) { const dir=directions[board.direction];dir.forEach(([dr,dc],i)=>img(i===2?'bigdot':'smalldot',(board.y+dc+1)*TILE,(board.x+dr+1)*TILE)); }
    if(hint==='overflow')img('skillissue',260,220);
    else if(hint==='undo')img('undo',(board.y+1)*TILE,(board.x+1)*TILE);
    else if(typeof hint==='number')directions[hint].forEach(([dr,dc])=>img('hintdot',(board.y+dc+1)*TILE,(board.x+dr+1)*TILE));
    img('instruction',900,0);
    if(boardMode==='normal'&&progress.flags>0)img('flag',900,635);
    if(boardMode==='normal'){text(bonus?'Level ???':`Level ${levelNumber}`,400,685,35);text(`Level point: ${Math.max(0,Math.floor(levelPoint))}`,700,665,15);text(`Total point: ${progress.points}`,700,685,15);if(progress.flags>0)text(`Flag uses left: ${progress.flags}`,25,675,22);}
    else text(boardMode==='custom'?editor?.name||'Custom Level':`Level ${levelNumber}`,400,685,35);
    if(flagHelp)img('flagins',0,0);
  }
  function draw() {
    ctx.clearRect(0,0,W,H);ctx.fillStyle='black';ctx.fillRect(0,0,W,H);
    if(screen==='title') {img('title',0,0);img('settingicon',10,600);['CONTINUE','REPLAY','MORE','EXIT'].forEach((s,i)=>text(s,400,475+50*i,40,menuIndex===i?'white':'#888'));text(progress.level,638,475,40,menuIndex===0?'white':'#888');if(menuIndex===1){img('arrows',580,492);text(String(replayIndex).padStart(2,'0'),638,525,40);}if(progress.level<=30)text('Beat level 30 for more!',600,575,20,'#888');}
    else if(screen==='board')renderBoard();
    else if(screen==='win'||screen==='victory'||screen==='reset')img(screen==='victory'?'victory':screen==='reset'?'resetscreen':winImage,0,0);
    else if(screen==='more'){img('midtitle',0,0);img('mouse',103+393*moreIndex,150);}
    else if(screen==='settings')drawSettings();
    else if(screen==='saved'||screen==='public')drawSaved();
    else if(screen==='custom')drawEditor();
  }
  function drawSettings(){img('exiticon',10,10);text('SETTINGS',410,50,45);const labels=['MENU MUSIC','INGAME MUSIC','THEME','HORSEY'];labels.forEach((s,i)=>text(s,60,i===3?450:110+60*i,26,i===selectedSetting?'white':'#888'));for(let i=0;i<2;i++){const n=progress[i?'gameVolume':'menuVolume'];text(n,300,110+60*i,26,i===selectedSetting?'white':'#888');ctx.fillStyle=i===selectedSetting?'white':'#888';ctx.fillRect(350,90+60*i,606,20);ctx.fillRect(350+6*n,80+60*i,6,40);}for(let i=0;i<2;i++){const theme=i?'stone':'grass';img(`${theme}_dirt`,175+125*i,275,100,100);for(let j=0;j<4;j++)img(`${theme}_${j}`,200+125*i+25*(j%2),300+25*Math.floor(j/2));if(selectedSetting===2&&progress.theme===theme)img('mouse',200+125*i,200);const horse=i?'mad':'default';ctx.fillStyle='#888';ctx.fillRect(200+125*i,475,50,25);img(`${horse}horseyleft`,200+125*i,475);img(`${horse}horseyright`,225+125*i,475);if(selectedSetting===3&&progress.horse===horse)img('mouse',200+125*i,400);}}
  function drawSaved(){img('savedlevelscreen',0,0);img('ins_saved_levels',0,0);const list=screen==='saved'?saved:Object.keys(LEVEL_DATA).filter(k=>Number(k)<50).sort((a,b)=>Number(a)-Number(b)).map(k=>({name:`Level ${k}`,id:Number(k)}));const page=screen==='saved'?savedPage:Math.floor(publicIndex/10), index=screen==='saved'?savedIndex:publicIndex%10;text(`Page ${page+1}/${Math.max(1,Math.ceil(list.length/10))}`,740,32,35);for(let i=0;i<10;i++){const item=list[page*10+i];if(!item)break;text(item.name.toUpperCase(),300,107+i*60,35,i===index?'white':'#888');}if(page>0)img('arrowleft',23,300);if((page+1)*10<list.length)img('arrowright',941,300);if(!list.length)text('No saved levels yet',300,150,30);}
  function drawEditor(){if(editor.verified){img('savelevelscreen',0,0);if(editor.saving){text(`Level name: ${rename}`,100,200,35);text('Enter to save · Backspace to edit',100,250,23);}}else{ctx.fillStyle='#8a4f34';ctx.fillRect(0,0,W,H);img(`${progress.theme}_dirt`,25,25);img('exiticon',10,650);const grid=editor.verifying?board.grid:editor.level.grid;for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(grid[r][c]>=0)img(`${progress.theme}_${Math.min(3,grid[r][c])}`,(c+1)*25,(r+1)*25);const teles=editor.level.teles;for(let i=0;i<teles.length;i++){const t=teles[i];img('telein',(t.sy+1)*25,(t.sx+1)*25);img('teleout',(t.ey+1)*25,(t.ex+1)*25);}if(editor.level.x>=0)img(`${progress.horse}horseyright`,((editor.verifying?board.y:editor.level.y)+1)*25,((editor.verifying?board.x:editor.level.x)+1)*25);img(editor.verifying?'ins_verify':'ins_custom',900,0);if(!editor.verifying)img('custom_cursor',(editor.cy+1)*25,(editor.cx+1)*25);if(editor.pendingTele)text('Move cursor, then Enter to place teleporter exit',190,24,20);text('Custom Level',400,685,35);}}
  function saveCustom(){const name=rename.trim();if(!name){showNotice('Enter a level name.');return;}if(saved.some(l=>l.name.toLowerCase()===name.toLowerCase())){showNotice('That name is already used.');return;}saved.unshift({name,level:editor.level});persistSaved();editor=null;setScreen('more');}
  function startEditor(level=null,name=''){const empty={x:-1,y:-1,steps:0,teleSteps:0,grid:Array.from({length:ROWS},()=>Array(COLS).fill(-1)),teles:[]};editor={level:level?cloneLevel(level):empty,name,cx:0,cy:0,verifying:false,verified:false,saving:false,pendingTele:null};setScreen('custom');}
  function verifyEditor(){if(editor.verifying){editor.verifying=false;editor.verified=false;return;}if(editor.level.x<0){showNotice('Place the knight with K first.');return;}const sum=editor.level.grid.flat().reduce((a,n)=>a+Math.max(0,n),0)-1;if(sum<0){showNotice('Add tiles before verifying.');return;}editor.level.steps=Math.floor(sum/3);editor.level.teleSteps=sum%3;begin(editor.level,'custom',0);editor.verifying=true;screen='custom';syncAudio();draw();}
  function handleEditor(key){if(editor.saving){if(key==='Enter')saveCustom();else if(key==='Backspace')rename=rename.slice(0,-1);else if(key.length===1&&/[a-z0-9 ]/i.test(key)&&rename.length<21)rename+=key;return;}
    if(editor.verified){if(key.toLowerCase()==='s'){editor.saving=true;rename=editor.name||'';}else if(key.toLowerCase()==='e'){editor.verified=false;editor.verifying=false;}return;}
    if(editor.verifying){if(key==='ArrowUp')selectDirection(1);else if(key==='ArrowDown')selectDirection(-1);else if(key==='Enter'){doMove();if(screen==='win'){editor.verified=true;editor.verifying=false;setScreen('custom');}}else if(key==='ArrowLeft')undo();else if(key.toLowerCase()==='v'){editor.verifying=false;}else if(key.toLowerCase()==='e')setScreen('more');return;}
    if(key==='ArrowUp')editor.cx=Math.max(0,editor.cx-1);else if(key==='ArrowDown')editor.cx=Math.min(24,editor.cx+1);else if(key==='ArrowLeft')editor.cy=Math.max(0,editor.cy-1);else if(key==='ArrowRight')editor.cy=Math.min(34,editor.cy+1);
    else if('0123'.includes(key)&&key.length===1)editor.level.grid[editor.cx][editor.cy]=Number(key)-1;
    else if(key.toLowerCase()==='k'){editor.level.x=editor.cx;editor.level.y=editor.cy;}
    else if(key.toLowerCase()==='v')verifyEditor();
    else if(key.toLowerCase()==='t'){editor.pendingTele={sx:editor.cx,sy:editor.cy};}
    else if(key==='Enter'&&editor.pendingTele){const t={...editor.pendingTele,ex:editor.cx,ey:editor.cy};if(t.sx!==t.ex||t.sy!==t.ey)editor.level.teles.push(t);editor.pendingTele=null;}
    else if(key.toLowerCase()==='d')editor.level.teles=editor.level.teles.filter(t=>![[t.sx,t.sy],[t.ex,t.ey]].some(([x,y])=>x===editor.cx&&y===editor.cy));
    else if(key.toLowerCase()==='e')setScreen('more');}
  function handle(key){if(screen==='custom'){handleEditor(key);draw();return;}
    if(screen==='title'){if(key==='ArrowDown'){menuIndex=(menuIndex+1)%4;if(progress.level<=30&&menuIndex===2)menuIndex=3;}else if(key==='ArrowUp'){menuIndex=(menuIndex+3)%4;if(progress.level<=30&&menuIndex===2)menuIndex=1;}else if(menuIndex===1&&key==='ArrowLeft')replayIndex=Math.max(0,replayIndex-1);else if(menuIndex===1&&key==='ArrowRight')replayIndex=Math.min(Math.max(0,progress.level-1),replayIndex+1);else if(key.toLowerCase()==='s')setScreen('settings');else if(key==='Enter'){if(menuIndex===0)loadMain();else if(menuIndex===1)begin(parseLevel(LEVEL_DATA[String(replayIndex)]),'replay',replayIndex);else if(menuIndex===2)setScreen('more');else location.href='../more.html';}}
    else if(screen==='board'){if(key==='ArrowUp'){hint=null;selectDirection(1);}else if(key==='ArrowDown'){hint=null;selectDirection(-1);}else if(key==='Enter')doMove();else if(key==='ArrowLeft')undo();else if(key.toLowerCase()==='h'){if(hint!==null)hint=null;else findHint();}else if(key.toLowerCase()==='f'&&boardMode==='normal'&&progress.flags>0&&!flagged){if(flagHelp){flagHelp=false;flagged=true;progress.flags--;persist();}else flagHelp=true;}else if(key.toLowerCase()==='e')setScreen(boardMode==='custom'?'saved':'title');else if(key.toLowerCase()==='x')setScreen('title');}
    else if(screen==='win'||screen==='reset'){if(key===' '||key==='Enter'){if(boardMode==='normal')loadMain();else setScreen(boardMode==='custom'?'saved':'title');}else if(key.toLowerCase()==='e')setScreen('title');}
    else if(screen==='victory'){if(key.toLowerCase()==='e'||key==='Enter')setScreen('title');}
    else if(screen==='settings'){if(key==='ArrowUp')selectedSetting=(selectedSetting+3)%4;else if(key==='ArrowDown')selectedSetting=(selectedSetting+1)%4;else if(key==='ArrowLeft'||key==='ArrowRight'){const d=key==='ArrowRight'?1:-1;if(selectedSetting===0)progress.menuVolume=Math.max(0,Math.min(100,progress.menuVolume+d));if(selectedSetting===1)progress.gameVolume=Math.max(0,Math.min(100,progress.gameVolume+d));if(selectedSetting===2)progress.theme=progress.theme==='grass'?'stone':'grass';if(selectedSetting===3)progress.horse=progress.horse==='default'?'mad':'default';persist();syncAudio();}else if(key.toLowerCase()==='e')setScreen('title');}
    else if(screen==='more'){if(key==='ArrowRight')moreIndex=(moreIndex+1)%3;else if(key==='ArrowLeft')moreIndex=(moreIndex+2)%3;else if(key==='Enter'){if(moreIndex===0)setScreen('public');else if(moreIndex===1){savedIndex=0;savedPage=0;setScreen('saved');}else startEditor();}else if(key.toLowerCase()==='e')setScreen('title');}
    else if(screen==='saved'){const pageCount=Math.max(1,Math.ceil(saved.length/10));if(key==='ArrowRight')savedPage=Math.min(pageCount-1,savedPage+1),savedIndex=0;else if(key==='ArrowLeft')savedPage=Math.max(0,savedPage-1),savedIndex=0;else if(key==='ArrowDown')savedIndex=(savedIndex+1)%Math.max(1,Math.min(10,saved.length-savedPage*10));else if(key==='ArrowUp')savedIndex=(savedIndex-1+Math.max(1,Math.min(10,saved.length-savedPage*10)))%Math.max(1,Math.min(10,saved.length-savedPage*10));else if(key==='Enter'&&saved.length){const item=saved[savedPage*10+savedIndex];begin(item.level,'custom',0);editor={name:item.name};}else if(key.toLowerCase()==='l'&&saved.length){const item=saved[savedPage*10+savedIndex];startEditor(item.level,item.name);}else if(key.toLowerCase()==='x'&&saved.length){const item=saved[savedPage*10+savedIndex];if(confirm(`Delete ${item.name}?`)){saved.splice(savedPage*10+savedIndex,1);persistSaved();savedIndex=0;savedPage=0;}}else if(key.toLowerCase()==='e')setScreen('more');}
    else if(screen==='public'){if(key==='ArrowRight')publicIndex=Math.min(49,publicIndex+10);else if(key==='ArrowLeft')publicIndex=Math.max(0,publicIndex-10);else if(key==='ArrowDown')publicIndex=Math.min(49,publicIndex+1);else if(key==='ArrowUp')publicIndex=Math.max(0,publicIndex-1);else if(key==='Enter')begin(parseLevel(LEVEL_DATA[String(publicIndex)]),'replay',publicIndex);else if(key.toLowerCase()==='e')setScreen('more');}
    draw();}
  document.addEventListener('keydown',event=>{if(event.target.tagName==='BUTTON'&&(event.key===' '||event.key==='Enter'))return;activateSound();const key=event.key;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Enter','Backspace'].includes(key))event.preventDefault();if(screen==='board'&&key.toLowerCase()==='d'){if(!resetHold)resetHold=performance.now();return;}handle(key);});
  document.addEventListener('keyup',event=>{if(event.key.toLowerCase()==='d')resetHold=0;});
  for(const button of document.querySelectorAll('[data-key]'))button.addEventListener('click',()=>{activateSound();if(button.dataset.key==='reset'){if(confirm('Reset game progress and settings?')){progress={...defaults};persist();loadMain();setScreen('reset');}}else if(screen==='custom'&&editor.verified&&button.dataset.key==='s'){const name=prompt('Level name',editor.name||'');if(name!==null){rename=name.slice(0,21);saveCustom();}}else handle(button.dataset.key);canvas.focus();});
  canvas.addEventListener('pointerdown',event=>{activateSound();const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)*W/rect.width,y=(event.clientY-rect.top)*H/rect.height;canvas.focus();if(screen==='title'){if(x<100&&y>580){setScreen('settings');return;}if(x>370&&x<780&&y>430&&y<650){menuIndex=Math.max(0,Math.min(3,Math.floor((y-440)/50)));handle('Enter');return;}}else if(screen==='more'&&y>130&&y<450){moreIndex=Math.max(0,Math.min(2,Math.floor(x/347)));handle('Enter');return;}else if(screen==='board'&&x<900&&y<650){if(board.direction!==null)handle('Enter');else handle('ArrowUp');return;}else if(screen==='win'||screen==='reset'){handle(' ');return;}else if(screen==='saved'||screen==='public'){const i=Math.floor((y-70)/60);if(i>=0&&i<10){if(screen==='saved')savedIndex=i;else publicIndex=Math.floor(publicIndex/10)*10+i;handle('Enter');return;}}else if(screen==='settings'&&x<85&&y<75){handle('e');return;}draw();});
  function frame(now){if(screen==='board'){if(now-lastTick>=100){const ticks=Math.floor((now-lastTick)/100);lastTick+=ticks*100;levelPoint=Math.max(0,levelPoint-ticks*5);draw();}if(resetHold&&now-resetHold>=1500){resetHold=0;progress={...defaults};persist();loadMain();setScreen('reset');}}requestAnimationFrame(frame);}
  document.fonts.ready.then(draw);draw();requestAnimationFrame(frame);
})();
