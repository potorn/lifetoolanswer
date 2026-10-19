import { byId as $, node, table, csv, download, drawLines, reportPng } from './tool-reports.js?v=20261019-theme1';
import { clock, resolveRun, splitRows, localDate, validRun, cleanRuns } from './pace-record-math.js?v=20261019';
document.addEventListener('DOMContentLoaded', () => {
  const form = $('paceForm'); let current = null;
  const splits = node('section', undefined, 'card upgrade-panel'); splits.id = 'splitSection';
  splits.append(node('h2', '목표 거리별 1km 통과 시간표'), node('p', '먼저 위에서 페이스를 계산하세요. 같은 페이스를 유지할 때의 예상 통과 시간입니다.', 'upgrade-help'));
  const targetLabel = node('label', '목표 거리'); targetLabel.htmlFor = 'splitDistance'; const target = node('select'); target.id = 'splitDistance';
  [['5','5km'],['10','10km'],['21.0975','하프 마라톤'],['42.195','풀 마라톤']].forEach(([v,l]) => target.add(new Option(l,v)));
  const splitOutput = node('div'), splitSave = node('button','통과 시간표 CSV 저장'); splitSave.type = 'button'; splitSave.disabled = true;
  splits.append(targetLabel,target,splitOutput,splitSave); document.querySelector('.health-workspace').after(splits);
  const history = node('section',undefined,'card upgrade-panel'); history.id = 'runHistory'; history.append(node('h2','나의 걷기·달리기 기록'),node('p','계산한 거리·시간을 저장하고 전체·월별 기록을 모아보세요. 같은 날 여러 운동을 저장할 수 있습니다.','upgrade-help'));
  const entry = node('div',undefined,'upgrade-actions');
  const dateLabel = node('label','운동 날짜'); dateLabel.htmlFor = 'runDate'; const date = node('input'); date.type='date'; date.id='runDate'; date.value=date.max=localDate(new Date()); date.min='1900-01-01';
  const kindLabel = node('label','운동 종류'); kindLabel.htmlFor='runKind'; const kind=node('select'); kind.id='runKind'; kind.add(new Option('달리기','run')); kind.add(new Option('걷기','walk'));
  const save=node('button','계산한 운동 기록 저장'); save.type='button'; save.disabled=true; entry.append(dateLabel,date,kindLabel,kind,save);
  const status=node('p','','upgrade-status'); status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
  const filters=node('div',undefined,'upgrade-actions'); const periodLabel=node('label','조회·내보내기 기간'); periodLabel.htmlFor='runPeriod'; const period=node('select'); period.id='runPeriod'; period.add(new Option('전체 기록','all'));
  const metricLabel=node('label','그래프 항목'); metricLabel.htmlFor='runMetric'; const metric=node('select'); metric.id='runMetric'; metric.add(new Option('거리 (km)','distance')); metric.add(new Option('시간 (분)','time')); filters.append(periodLabel,period,metricLabel,metric);
  const report=node('div'), actions=node('div',undefined,'upgrade-actions');
  const exportCsv=node('button','기록 CSV 저장'), exportPng=node('button','그래프 PNG 저장'), backup=node('button','선택 기간 JSON 백업'), restore=node('button','백업 불러오기');
  [exportCsv,exportPng,backup,restore].forEach(b=>b.type='button'); const file=node('input'); file.type='file'; file.accept='.json,application/json'; file.hidden=true; actions.append(exportCsv,exportPng,backup,restore,file);
  history.append(entry,status,filters,report,actions,node('p','기록은 이 브라우저의 localStorage에만 저장합니다. 사이트 데이터 삭제·시크릿 모드 종료 시 사라질 수 있으며 다른 기기와 동기화되지 않습니다. 전체 기록을 JSON으로 백업하세요. CSV·PNG는 보관용이고 복원에는 JSON을 사용합니다.','upgrade-help')); splits.after(history);
  const key='lifetoolanswer.pace.history.v1'; let records=[], ready=true, canvas, chartTitle;
  try { const raw=localStorage.getItem(key); if(raw){const data=JSON.parse(raw);if(data.version!==1)throw Error('version');records=cleanRuns(data.records);} }
  catch { ready=false; status.textContent='기록을 읽을 수 없어 저장·삭제·불러오기를 중단했습니다. 브라우저 저장 권한과 사이트 데이터를 확인하세요.'; }
  restore.disabled=!ready;
  function persist(next){if(!ready)return false;try{next=cleanRuns(next);localStorage.setItem(key,JSON.stringify({version:1,records:next}));records=next;return true;}catch{status.textContent='저장하지 못했습니다. 저장 공간·권한·기록 수(최대 10,000건)를 확인하세요. 기존 기록은 유지됩니다.';return false;}}
  function updateSplits(){splitOutput.replaceChildren();splitSave.disabled=!current;if(!current)return;const rows=splitRows(Number(target.value),current.pace).map(r=>[r.distance+'km',clock(r.segment),clock(r.seconds)]);splitOutput.append(table(['통과 지점','해당 구간 시간','누적 통과 시간'],rows));splitSave.onclick=()=>csv([['통과 지점','해당 구간 시간','누적 통과 시간'],...rows],'running-splits.csv');}
  target.addEventListener('change',updateSplits);
  form.addEventListener('submit',()=>{if($('paceValues').hidden){current=null;save.disabled=true;updateSplits();return;}try{const n=id=>Number($(id).value||0);current=resolveRun({mode:form.querySelector('input[name="paceMode"]:checked').value,unit:$('paceUnit').value,distance:n('paceDistance'),hours:n('durationHours'),minutes:n('durationMinutes'),seconds:n('durationSeconds'),paceMinutes:n('paceMinutes'),paceSeconds:n('paceSeconds')});save.disabled=!ready;updateSplits();}catch{current=null;save.disabled=true;updateSplits();}});
  const invalidate=()=>{current=null;save.disabled=true;updateSplits();};form.addEventListener('input',invalidate);form.addEventListener('change',invalidate);form.querySelectorAll('[data-distance]').forEach(b=>b.addEventListener('click',invalidate));
  save.onclick=()=>{if(!current||!ready)return;const record={id:crypto.randomUUID(),date:date.value,kind:kind.value,distance:current.distance,seconds:current.seconds};if(!validRun(record)){status.textContent='날짜(1900년 이후~오늘), 거리·시간 입력 범위를 확인하세요.';return;}if(persist(records.concat(record))){period.value='all';render();status.textContent=record.date+' 운동을 기록했습니다.';}};
  const selected=()=>records.filter(r=>period.value==='all'||r.date.startsWith(period.value));
  const headers=['날짜','운동','거리 (km)','시간 (시:분:초)','평균 페이스 (시:분:초/km)'];const rowsFor=list=>list.map(r=>[r.date,r.kind==='run'?'달리기':'걷기',Number(r.distance.toFixed(4)),clock(r.seconds),clock(r.seconds/r.distance)]);
  function render(){
    const prev = period.value;
    const months = Array.from(new Set(records.map(r => r.date.slice(0, 7)))).sort().reverse();
    if (Array.from(period.options).map(option => option.value).join('|') !== ['all', ...months].join('|')) {
      period.replaceChildren(new Option('전체 기록', 'all'));
      months.forEach(month => period.add(new Option(month.slice(0, 4) + '년 ' + Number(month.slice(5)) + '월', month)));
      period.value = months.includes(prev) ? prev : 'all';
    }
    const list=selected();[exportCsv,exportPng,backup].forEach(b=>b.disabled=!list.length);report.replaceChildren();chartTitle=period.value==='all'?'전체 운동 기록 · 월별 합계':period.value+' 운동 기록 · 기록일별 합계';report.append(node('h3',chartTitle));
    if(!list.length){report.append(node('p','아직 기록이 없습니다. 위에서 계산한 운동을 저장해 보세요.','upgrade-empty'));return;}
    report.append(node('p',list.length+'회 · 총 '+list.reduce((s,r)=>s+r.distance,0).toFixed(2)+'km · 총 '+clock(list.reduce((s,r)=>s+r.seconds,0)),'upgrade-summary'));
    const grouped=new Map();list.forEach(r=>{const label=period.value==='all'?r.date.slice(0,7):r.date;grouped.set(label,(grouped.get(label)||0)+(metric.value==='distance'?r.distance:r.seconds/60));});
    canvas=node('canvas');canvas.width=1200;canvas.height=540;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',chartTitle+'. 상세 값은 아래 표를 확인하세요.');report.append(canvas);drawLines(canvas,Array.from(grouped.keys()),[{name:metric.value==='distance'?'운동 거리':'운동 시간',color:'#3678cf',values:Array.from(grouped.values())}],metric.value==='distance'?'km':'분');
    report.append(table(['집계 기간',metric.value==='distance'?'운동 거리 (km)':'운동 시간 (분)'],Array.from(grouped,([k,v])=>[k,v.toFixed(2)])));
    const rows=list.slice().reverse().map(r=>{const td=node('td'),remove=node('button','삭제');remove.type='button';remove.disabled=!ready;remove.setAttribute('aria-label',r.date+' '+r.distance.toFixed(2)+'km 기록 삭제');remove.onclick=()=>{if(confirm(r.date+' 운동 기록을 삭제할까요?')&&persist(records.filter(item=>item.id!==r.id))){render();status.textContent='기록을 삭제했습니다.';}};td.append(remove);return [...rowsFor([r])[0],td];});const detail=node('details');detail.open=true;detail.append(node('summary','개별 운동 기록'),table([...headers,'관리'],rows));report.append(detail);
  }
  period.addEventListener('change',render);metric.addEventListener('change',render);
  exportCsv.onclick=()=>csv([headers,...rowsFor(selected())],'exercise-'+period.value+'.csv');
  exportPng.onclick=()=>{const list=selected();if(list.length)reportPng('생활도구 · 걷기·달리기 기록',[chartTitle,list.length+'회 · 총 '+list.reduce((s,r)=>s+r.distance,0).toFixed(2)+'km · 총 '+clock(list.reduce((s,r)=>s+r.seconds,0))],canvas,'exercise-'+period.value+'.png');};
  backup.onclick=()=>download(new Blob([JSON.stringify({version:1,records:selected()},null,2)],{type:'application/json'}),'exercise-'+period.value+'.json');restore.onclick=()=>file.click();
  file.addEventListener('change',async()=>{const f=file.files[0];file.value='';if(!f||!ready)return;if(f.size>5*1024*1024){status.textContent='백업은 5MB 이하만 불러올 수 있습니다.';return;}try{const data=JSON.parse(await f.text());if(data.version!==1)throw Error('version');const incoming=cleanRuns(data.records);if(!confirm(incoming.length+'건을 기존 기록과 합칠까요? 동일 ID는 백업 값으로 바뀝니다.'))return;const merged=new Map(records.map(r=>[r.id,r]));incoming.forEach(r=>merged.set(r.id,r));if(persist(Array.from(merged.values()))){period.value='all';render();status.textContent=incoming.length+'건을 불러왔습니다.';}}catch{status.textContent='올바른 운동 기록 백업이 아닙니다. 기존 기록은 변경하지 않았습니다.';}});
  window.addEventListener('storage',event=>{if(event.key===key||event.key===null){ready=false;save.disabled=restore.disabled=true;render();status.textContent='다른 탭에서 기록이 변경되었습니다. 새로고침하여 최신 기록을 불러오세요.';}});render();
});
