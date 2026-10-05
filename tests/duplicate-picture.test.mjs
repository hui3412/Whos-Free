import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Window } from 'happy-dom';
const original = { semester: 'Winter 2026', classes: [{day:'Monday',start:'09:00',end:'10:00',course:'Old math'}] };
const incoming = { name: '', person: { source_file:'picture.png', classes:[{day:'Tuesday',start:'11:00',end:'12:00',course:'New math',review_warning:'Check text',recognition_confidence:40}] } };
async function setup(extra = {}) {
 const w = new Window({url:'http://localhost/',settings:{disableJavaScriptFileLoading:true,disableCSSFileLoading:true}});
 w.document.write(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'));
 w.setInterval=()=>0;w.matchMedia=()=>({matches:true,addEventListener(){}});w.confirm=()=>{throw new Error('Picture duplicates must use three choices')};
 w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
 const people={Alice:original,...extra};
 w.localStorage.setItem('whos-free-local-schedules',JSON.stringify({data:{schema_version:1,people},meta:{}}));
 w.localStorage.setItem('whos-free-people-preferences-v1',JSON.stringify({nicknames:{Alice:'Al'},pinnedPeople:['Alice']}));
 w.WhosFreeImageParser={parseScheduleImage:async()=>JSON.parse(JSON.stringify(incoming))};
 const el=id=>w.document.getElementById(id),tick=()=>new Promise(r=>setTimeout(r,40));
 for(const f of ['schedule-availability.js','schedule-groups.js','schedule-share-code.js','app.js'])w.eval(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'));
 await tick();
 Object.defineProperty(el('scheduleImageInput'),'files',{value:[{name:'picture.png'}],configurable:true});el('scheduleImageInput').dispatchEvent(new w.Event('change'));await tick();
 el('imageReviewName').value='Alice';el('imageReviewSemester').value='Fall';el('imageReviewYear').value='2026';
 const stored=()=>JSON.parse(w.localStorage.getItem('whos-free-local-schedules'));
 const choose=async action=>{el('duplicatePicturePrompt').querySelector(`[data-duplicate-action="${action}"]`).click();await tick()};
 return {w,el,tick,stored,choose};
}
for(const action of ['replace','both','cancel'])test(`picture duplicate choice ${action} preserves data, review state and Undo`,async()=>{
 const {w,el,tick,stored,choose}=await setup({'Alice 2':{semester:'Fall 2026',classes:[]}});
 try {
  const before=stored();el('saveImageScheduleButton').click();
  assert.equal(el('duplicatePicturePrompt').hidden,false);assert.equal(el('saveImageScheduleButton').disabled,true);assert.deepEqual(stored(),before);
  assert.match(el('duplicatePictureMessage').textContent,/Alice 3/);await choose(action);
  if(action==='cancel') {
   assert.deepEqual(stored(),before);assert.equal(el('imageReview').hidden,false);assert.equal(el('undoChangesButton').disabled,true);
   assert.equal(el('saveImageScheduleButton').disabled,false);return;
  }
  const name=action==='replace'?'Alice':'Alice 3';const person=stored().data.people[name];
  assert.equal(person.semester,'Fall 2026');assert.equal(person.classes[0].course,'New math');assert.equal(person.classes[0].review_warning,'Check text');
  if(action==='both')assert.deepEqual(stored().data.people.Alice,original);
  assert.deepEqual(JSON.parse(w.localStorage.getItem('whos-free-people-preferences-v1')),{nicknames:{Alice:'Al'},pinnedPeople:['Alice']});
  const decoded=await w.WhosFreeShareCode.decode(await w.WhosFreeShareCode.encode(stored().data));assert.equal(decoded.people[name].semester,'Fall 2026');
  let file;w.URL.createObjectURL=value=>{file=value;return 'blob:export'};el('shareSchedulesButton').click();
  assert.deepEqual(JSON.parse(new TextDecoder().decode(await file.arrayBuffer())).people[name],person);
  el('undoChangesButton').click();await tick();assert.deepEqual(stored().data,before.data);
 }finally{await w.happyDOM.abort()}
});
test('normalized name collisions replace the original key and Escape cancels only the prompt',async()=>{
 const {w,el,tick,stored,choose}=await setup();try{
  el('imageReviewName').value='  aLiCe  ';el('saveImageScheduleButton').click();
  w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(el('duplicatePicturePrompt').hidden,true);assert.equal(el('imageReview').hidden,false);assert.equal(el('scheduleModal').hidden,false);
  el('saveImageScheduleButton').click();await choose('replace');assert.deepEqual(Object.keys(stored().data.people),['Alice']);
  assert.equal(stored().data.people.Alice.classes[0].course,'New math');
 }finally{await w.happyDOM.abort()}
});
test('changing the name during the prompt revalidates the decision and cancellation leaves later uploads usable',async()=>{
 const {w,el,tick,stored,choose}=await setup({Bob:{semester:'Fall 2026',classes:[]}});try{
  el('saveImageScheduleButton').click();el('imageReviewName').value='Bob';await choose('replace');
  assert.equal(el('duplicatePicturePrompt').hidden,false);assert.match(el('duplicatePictureMessage').textContent,/Bob/);
  assert.equal(stored().data.people.Alice.classes[0].course,'Old math');
  el('cancelImageScheduleButton').click();assert.equal(el('duplicatePicturePrompt').hidden,true);assert.equal(el('imageReview').hidden,true);
  el('scheduleImageInput').dispatchEvent(new w.Event('change'));await tick();el('imageReviewName').value='New person';el('saveImageScheduleButton').click();await tick();
  assert.equal(stored().data.people['New person'].classes[0].course,'New math');assert.equal(el('duplicatePicturePrompt').hidden,true);
 }finally{await w.happyDOM.abort()}
});
