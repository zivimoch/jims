'use strict';
const $ = (selector) => document.querySelector(selector);
const sidebarClose = document.createElement('button');
sidebarClose.className = 'sidebar-close';
sidebarClose.id = 'sidebar-close';
sidebarClose.type = 'button';
sidebarClose.setAttribute('aria-label', 'Sembunyikan navigasi');
sidebarClose.textContent = '←';
document.querySelector('#sidebar').prepend(sidebarClose);
const icon = (name) => `<svg aria-hidden="true"><use href="#${name}"/></svg>`;
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initial = { profile: 'Alex Ferguson', selected: 'youth', events: [
  {id:'youth',title:'Pengajian Muda-Mudi',level:'Desa',location:'Mesjid Al Barokah Lantai 1',date:'2026-09-25',start:'20:00',end:'21:30',icon:'moon',material:'Al-Quran (surat x ayat x), Hadist, Nasehat'},
  {id:'general',title:'Pengajian Ikhwan Umum',level:'Daerah',location:'Al Manshurin',date:'2026-09-25',start:'20:00',end:'21:30',icon:'users',material:'Hadist K.Sholah (hal 8), Nasehat, Asad'}
], people: {youth: [
  {id:'zifi',name:'Zifi Ahmad Fauzi',nickname:'Zifi',initials:'ZI',color:'mint',time:'20:05',status:'offline'},
  {id:'raka',name:'Raka Pratama',nickname:'Raka',initials:'RA',color:'blue',time:'20:07',status:'online'},
  {id:'ahmad',name:'Ahmad Nur Hidayat',nickname:'Ahmad',initials:'AH',color:'amber',time:'20:10',status:'offline'},
  {id:'fikri',name:'Muhammad Fikri',nickname:'Fikri',initials:'FI',color:'purple',time:'20:12',status:'online'},
  {id:'dimas',name:'Dimas Ramadhan',nickname:'Dimas',initials:'DI',color:'pink',time:'20:14',status:'offline'}
], general:[]}, history:[] };
let state = structuredClone(initial);
try {const saved = JSON.parse(localStorage.getItem('jims-demo-v1')); if(saved && Array.isArray(saved.events) && saved.people && Array.isArray(saved.history) && typeof saved.profile === 'string') state = saved;} catch {}
// Add this requested demo set once, preserving later attendance edits.
if(!state.sambungDemo20260926){
 const demoDate=localDemoDate();
 const activities=[
  {id:'sambung-barokah-20260926',location:'Al-Barokah',materials:[{type:'Al-Quran',surah:'2',verse:'213'},{type:'Hadist',book:'K.Khotbah',page:'20',note:'Jilid 1'},{type:'Nasehat'}]},
  {id:'sambung-manshurin-20260926',location:'Al-Manshurin',materials:[{type:'CAI',page:'2'},{type:'Hadist',book:'K.Khotbah',page:'20',note:'Jilid 1'},{type:'Asad'}]}
 ];
 const names=[
  ['Zifi Ahmad Fauzi','Zifi'],['Raka Pratama','Raka'],['Ahmad Nur Hidayat','Ahmad'],['Muhammad Fikri','Fikri'],['Dimas Ramadhan','Dimas'],
  ['Fajar Maulana','Fajar'],['Rizky Saputra','Rizky'],['Budi Santoso','Budi'],['Ilham Ramadhan','Ilham'],['Arif Setiawan','Arif'],
  ['Yusuf Hidayat','Yusuf'],['Hendra Wijaya','Hendra'],['Agus Salim','Agus'],['Deni Kurniawan','Deni'],['Faris Akbar','Faris'],
  ['Rian Firmansyah','Rian'],['Aldi Prasetyo','Aldi'],['Hasan Basri','Hasan'],['Irfan Hakim','Irfan'],['Dani Saputra','Dani']
 ];
 activities.forEach((activity,group)=>{
  const event={...activity,title:'Sambung Kelompok',level:'Kelompok',className:'Umum',date:demoDate,start:'05:00',end:'22:00',icon:'mosque',note:'',zoomUrl:''};
  event.material=event.materials.map(materialText).join(', ');
  if(!state.events.some(e=>e.id===event.id))state.events.unshift(event);
  state.people[event.id]=names.slice(group*10,group*10+10).map(([name,nickname],i)=>{
   const time='05:'+String(i*2+group).padStart(2,'0');
   const status=i===8?'izin':i%3===1?'online':'offline';
   return {id:name.toLocaleLowerCase('id'),name,nickname,initials:name.split(' ').slice(0,2).map(word=>word[0]).join(''),color:['mint','blue','amber','purple','pink'][i%5],time,recordedAt:new Date(demoDate+'T'+time+':00+07:00').getTime(),status,reason:status==='izin'?'Sakit':status==='online'?'Bekerja':''};
  });
 });
 state.selected=activities[0].id;
 state.sambungDemo20260926=true;
 try{localStorage.setItem('jims-demo-v1',JSON.stringify(state));}catch{}
}
function localDemoDate(now=new Date()){
 return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
function refreshDemoDates(now=new Date()){
 const today=localDemoDate(now);
 const demoIds=['youth','general','sambung-barokah-20260926','sambung-manshurin-20260926'];
 let changed=false;
 state.events.forEach(event=>{
  if(demoIds.includes(event.id)&&!event.fixedDemoDate&&event.date!==today){event.date=today;changed=true;}
 });
 if(changed){try{localStorage.setItem('jims-demo-v1',JSON.stringify(state));}catch{}}
 return changed;
}
refreshDemoDates();
state.events.forEach(event=>{if(event.material===undefined)event.material=initial.events.find(item=>item.id===event.id)?.material||'Ramah tamah';});
// Migrate the demo account without resetting saved activities or attendance.
if(state.accountVersion!==2){
 const previousName=state.profile;
 state.profile='Alex Ferguson';
 state.accountVersion=2;
 Object.values(state.people).forEach(people=>people.forEach(person=>{
  if(person.id==='self')Object.assign(person,{name:'Alex Ferguson',nickname:'Alex',initials:'AF'});
 }));
 state.history.forEach(entry=>{if(entry.name===previousName)entry.name='Alex Ferguson';});
 try{localStorage.setItem('jims-demo-v1',JSON.stringify(state));}catch{}
}
function renderProfile(){
 $('#profile-name').textContent=state.profile.split(' ')[0];
 $('#profile .avatar').textContent=state.profile.split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
 $('#profile').setAttribute('aria-label',`Profil ${state.profile}`);
}
if(!state.events.some(e=>e.id===state.selected)) state.selected=state.events[0]?.id||null;
let dialogMode = '', toastTimer;
const selected = () => state.events.find(e => e.id === state.selected);
function save(){try{localStorage.setItem('jims-demo-v1',JSON.stringify(state));}catch{notify('Penyimpanan browser tidak tersedia. Data hanya bertahan selama halaman terbuka.');}}
function notify(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
function dateLabel(date){return new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'short'}).format(new Date(date+'T12:00:00'));}
function renderEvents(){renderActivityCards();}
function renderPeople(){const all=state.people[state.selected]||[];const query=$('#people-search').value.toLocaleLowerCase('id');const filter=$('#status-filter').value;const people=[...all].sort((a,b)=>(b.recordedAt||0)-(a.recordedAt||0)||b.time.localeCompare(a.time)).filter(p=>(p.name+' '+p.nickname).toLocaleLowerCase('id').includes(query)&&(filter==='all'||p.status===filter));$('#people-count').textContent=`${all.length} jamaah`;
 $('#people').innerHTML=people.map(p=>`<li class="person"><span class="avatar ${['mint','blue','amber','purple','pink'].includes(p.color)?p.color:'mint'}">${escapeHTML(p.initials)}</span><div class="person-name"><strong>${escapeHTML(p.name)}</strong><small>(${escapeHTML(p.nickname)})</small>${p.reason?`<small class="reason-note">${escapeHTML(p.reason)}</small>`:''}</div><time>${escapeHTML(p.time)}</time><span class="status ${['offline','online','izin'].includes(p.status)?p.status:'offline'}" title="${p.status==='offline'?'Hadir offline':p.status==='online'?'Hadir online':'Izin'}" aria-label="${p.status==='offline'?'Hadir offline':p.status==='online'?'Hadir online':'Izin'}">${icon(p.status==='offline'?'mosque':p.status==='online'?'screen':'clock')}</span></li>`).join('')||'<li class="empty">'+(all.length?'Tidak ada jamaah yang cocok.':'Belum ada absensi. Jadilah yang pertama hadir!')+'</li>';
}
function renderHistory(){$('#history-list').innerHTML=state.history.slice().reverse().map(h=>`<li class="person"><span class="status ${h.status}">${icon(h.status==='offline'?'mosque':h.status==='online'?'screen':'clock')}</span><div class="person-name"><strong>${escapeHTML(h.event)}</strong><small>${escapeHTML(h.name)} · ${h.status==='offline'?'Hadir offline':h.status==='online'?'Hadir online':h.status==='cancelled'?'Absensi dibatalkan':'Izin'}${h.reason?' · '+escapeHTML(h.reason):''}</small></div><time>${escapeHTML(h.date)}</time></li>`).join('')||'<li class="empty">Belum ada riwayat. Catat absensi pertama Anda di halaman Absen.</li>';}
function ownAttendance(){return (state.people[state.selected]||[]).find(p=>p.id==='self');}
function sliderLabel(){const current=ownAttendance();return current?`Anda ${current.status==='offline'?'hadir offline':'Izin / Hadir Online'}, geser ke ${current.status==='offline'?'kanan':'kiri'} untuk cancel`:'Geser kiri untuk hadir offline, kanan untuk izin atau hadir online';}
function renderAttendanceStatus(){
 const current=ownAttendance();
 const side=current?(current.status==='offline'?'left':'right'):'';
 const control=$('#swipe-control');
 control.classList.toggle('locked-left',side==='left');
 control.classList.toggle('locked-right',side==='right');
 document.querySelectorAll('[data-attend]').forEach(button=>{
  const covered=!!current && (button.dataset.attend==='offline')===(side==='left');
  button.disabled=covered;
  button.tabIndex=covered?-1:0;
  button.setAttribute('aria-hidden',String(covered));
  button.removeAttribute('aria-pressed');
  button.querySelector('strong').textContent=current?(current.status==='offline'?'Anda hadir offline':'Anda Izin / Hadir Online'):(button.dataset.attend==='offline'?'Hadir Offline':'Izin / Hadir Online');
  button.querySelectorAll('small').forEach(hint=>hint.textContent=current?`Geser ke ${side==='left'?'kanan':'kiri'} untuk cancel`:button.dataset.attend==='offline'?'Geser ke kiri':'Geser ke kanan');
 });
 $('#attendance-feedback').textContent='';
 $('#fingerprint').setAttribute('aria-label',sliderLabel());
 renderZoomLink();
 syncThumb();
}
function chooseAttendance(direction){
 if(!selected()||eventStatus(selected())!=='Sedang berlangsung'){renderEvents();notify('Kegiatan ini tidak sedang berlangsung.');return;}
 const current=ownAttendance();
 if(current){
  // A locked selection can only be released by moving in the opposite direction.
  if((current.status==='offline' && direction==='offline')||(current.status!=='offline' && direction==='online'))return;
  state.people[state.selected]=state.people[state.selected].filter(p=>p.id!=='self');
  state.history.push({event:selected().title,name:current.name,status:'cancelled',date:new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date())});
  save();renderPeople();renderAttendanceStatus();snapFeedback();notify('Absensi Anda dibatalkan.');
 }else if(direction==='offline'){
  attend('offline');snapFeedback();
 }else{
  pendingRight=true;syncThumb();snapFeedback();openDialog('online');
 }
}
function attend(status,name=state.profile,self=true,reason=''){if(!selected()||eventStatus(selected())!=='Sedang berlangsung'){notify('Kegiatan ini tidak sedang berlangsung.');return;}const people=state.people[state.selected] ||= [];const id=self?'self':name.trim().toLocaleLowerCase('id');const existing=people.find(p=>p.id===id);const time=new Intl.DateTimeFormat('id-ID',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date()).replace('.',':');const person={id,name,recordedAt:Date.now(),nickname:name.split(' ')[0],initials:name.split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase(),color:'mint',time,status,reason};if(existing)Object.assign(existing,person);else people.push(person);state.history.push({event:selected().title,name,status,reason,date:new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date())});save();renderPeople();renderAttendanceStatus();notify(existing?'Status absensi diperbarui.':'Absensi berhasil disimpan.');}
function reasonFields(){return '<label>Alasan<select id="absence-reason" name="reason" required><option value="">Pilih alasan</option><option>Bekerja</option><option>Sekolah</option><option>Sakit</option><option>Lainnya</option></select></label><label id="custom-reason-label" hidden>Alasan lainnya<input id="custom-reason" name="customReason" maxlength="200" placeholder="Tulis alasan Anda..." disabled></label>';}
function field(label,name,type='text',value=''){return `<label>${label}<input name="${name}" type="${type}" value="${escapeHTML(value)}" required maxlength="100"></label>`;}
function openDialog(mode){dialogMode=mode;let title='',fields='';if(mode==='event'){title='Buat kegiatan baru';fields=eventFields();}else if(mode==='profile'){title='Edit profil demo';fields=field('Nama Anda','name','text',state.profile);}else if(mode==='other'){title='Absenkan jamaah lain';const candidates=Object.values(state.people).flat().filter((person,index,array)=>person.id!=='self'&&array.findIndex(item=>item.id===person.id)===index);fields='<label class="dialog-search">Cari jamaah<input id="other-search" type="search" placeholder="Cari nama jamaah..."></label><div class="select-people" id="other-people">'+(candidates.map(person=>`<label class="select-person" data-person-name="${escapeHTML((person.name+' '+person.nickname).toLocaleLowerCase('id'))}"><input type="checkbox" name="otherPeople" value="${escapeHTML(person.name)}"><span class="avatar ${person.color||'mint'}">${escapeHTML(person.initials)}</span><span><strong>${escapeHTML(person.name)}</strong><small>(${escapeHTML(person.nickname)})</small></span></label>`).join('')||'<p class="empty">Belum ada jamaah.</p>')+'</div><label>Status absensi<select name="status"><option value="offline">Hadir offline</option><option value="online">Hadir online</option><option value="izin">Izin</option></select></label>';}else{title='Izin / Hadir Online';fields='<label>Status absensi<select name="status"><option value="online">Hadir online</option><option value="izin">Izin</option></select></label>'; }if(mode==='online')fields+=reasonFields();$('#dialog-title').textContent=title;$('#dialog-fields').innerHTML=fields;$('#dialog').showModal();if(mode==='event')setupEventForm();if(mode==='online')$('#absence-reason').addEventListener('change',()=>{const other=$('#absence-reason').value==='Lainnya';$('#custom-reason-label').hidden=!other;$('#custom-reason').disabled=!other;$('#custom-reason').required=other;if(other)$('#custom-reason').focus();});if(mode==='other')$('#other-search').addEventListener('input',e=>{const query=e.target.value.toLocaleLowerCase('id');document.querySelectorAll('.select-person').forEach(row=>row.hidden=!row.dataset.personName.includes(query));});}
$('#dialog-form').addEventListener('submit',e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));for(const [key,value] of Object.entries(data)){data[key]=value.trim();if(!data[key]){notify('Mohon isi semua kolom.');return;}}if(dialogMode==='event'){if(data.end<=data.start){notify('Waktu selesai harus setelah waktu mulai.');return;}const id='event-'+Date.now();state.events.push({...data,id,icon:'users'});state.people[id]=[];state.selected=id;save();renderEvents();renderPeople();renderAttendanceStatus();notify('Kegiatan baru berhasil dibuat.');}else if(dialogMode==='profile'){state.profile=data.name;save();renderProfile();notify('Profil diperbarui.');}else attend(data.status,data.name||state.profile,dialogMode!=='other',data.reason==='Lainnya'?data.customReason:(data.reason||''));$('#dialog').close();});
$('#events').addEventListener('click',e=>{const card=e.target.closest('[data-event]');if(!card)return;state.selected=card.dataset.event;save();renderEvents();renderPeople();renderAttendanceStatus();});
$('#people-search').addEventListener('input',renderPeople);$('#status-filter').addEventListener('change',renderPeople);$('#filter-button').addEventListener('click',()=>{const open=$('#filter-options').hidden;$('#filter-options').hidden=!open;$('#filter-button').setAttribute('aria-expanded',String(open));});
$('#create-event').onclick=()=>openDialog('event');$('#other-attendance').onclick=()=>openDialog('other');$('#profile').onclick=()=>openDialog('profile');document.querySelectorAll('[data-attend]').forEach(b=>b.onclick=()=>chooseAttendance(b.dataset.attend));$('#close-dialog').onclick=$('#cancel-dialog').onclick=()=>$('#dialog').close();
function menu(open){$('#sidebar').classList.toggle('open',open);$('#backdrop').classList.toggle('open',open);$('#menu-button').setAttribute('aria-expanded',String(open));}$('#menu-button').onclick=()=>menu(!$('#sidebar').classList.contains('open'));$('#backdrop').onclick=()=>menu(false);document.addEventListener('keydown',e=>{if(e.key==='Escape')menu(false);});
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{const history=b.dataset.page==='history';$('#attendance-page').hidden=history;$('#history-page').hidden=!history;$('#page-title').textContent=history?'Riwayat Absen':'Absen';$('#page-description').textContent=history?'Catatan kehadiran dalam kegiatan Anda.':'Pilih kegiatan, lalu klik untuk absensi.';document.querySelectorAll('[data-page]').forEach(n=>n.classList.toggle('active',n===b));if(history)renderHistory();menu(false);});
// One pointer path for mouse, touch and pen, with a persistent resting position.
const thumb = $('#fingerprint');
const track = $('#swipe-control');
let drag = null;
let suppressClick = false;
let pendingRight = false;
let snapTimer;
function slideLimit(){return Math.max(1,(track.clientWidth-thumb.offsetWidth)/2-12);}
function restingSide(){const current=ownAttendance();return current?(current.status==='offline'?-1:1):pendingRight?1:0;}
function syncThumb(){
 const side=restingSide();
 thumb.style.setProperty('--slide-x',`${side*slideLimit()}px`);
 track.classList.toggle('resting-right',side===1);
 track.classList.toggle('resting-left',side===-1);
}
function snapFeedback(){
 clearTimeout(snapTimer);
 track.classList.remove('snapped');
 void track.offsetWidth;
 track.classList.add('snapped');
 snapTimer=setTimeout(()=>track.classList.remove('snapped'),420);
 if(navigator.vibrate)navigator.vibrate(18);
}
function resetDrag(){
 drag=null;
 track.classList.remove('dragging','toward-left','toward-right','slide-ready');
 track.style.setProperty('--slide-progress','0');
 thumb.setAttribute('aria-label',sliderLabel());
 syncThumb();
}
thumb.addEventListener('pointerdown',e=>{
 if(!e.isPrimary||e.button!==0||pendingRight)return;
 suppressClick=false;
 const limit=slideLimit(),side=restingSide();
 drag={id:e.pointerId,start:e.clientX,x:side*limit,origin:side*limit,side,limit,moved:false};
 thumb.setPointerCapture(e.pointerId);
 track.classList.add('dragging');
});
thumb.addEventListener('pointermove',e=>{
 if(!drag||e.pointerId!==drag.id)return;
 const delta=e.clientX-drag.start;
 drag.moved ||= Math.abs(delta)>6;
 const min=drag.side===1?0:-drag.limit;
 const max=drag.side===-1?0:drag.limit;
 drag.x=Math.max(min,Math.min(max,drag.origin+delta));
 const progress=Math.abs(drag.x-drag.origin)/drag.limit;
 thumb.style.setProperty('--slide-x',`${drag.x}px`);
 track.style.setProperty('--slide-progress',String(progress));
 track.classList.toggle('toward-left',delta<0);
 track.classList.toggle('toward-right',delta>0);
 track.classList.toggle('slide-ready',progress>=.65);
 thumb.setAttribute('aria-label',progress>=.65?(drag.side?'Lepaskan untuk cancel':drag.x<0?'Lepaskan untuk hadir offline':'Lepaskan untuk izin atau hadir online'):'Geser lebih jauh untuk memilih');
});
function endDrag(e,cancelled=false){
 if(!drag||e.pointerId!==drag.id)return;
 const {x,origin,limit,moved,id,side}=drag;
 suppressClick=moved||cancelled;
 drag=null;
 track.classList.remove('dragging','toward-left','toward-right','slide-ready');
 track.style.setProperty('--slide-progress','0');
 if(thumb.hasPointerCapture(id))thumb.releasePointerCapture(id);
 if(!cancelled&&moved&&Math.abs(x-origin)>=limit*.65){
  chooseAttendance(side?(side===-1?'online':'offline'):(x<0?'offline':'online'));
 }else syncThumb();
 thumb.setAttribute('aria-label',sliderLabel());
}
thumb.addEventListener('pointerup',e=>endDrag(e));
thumb.addEventListener('pointercancel',e=>endDrag(e,true));
thumb.addEventListener('lostpointercapture',e=>endDrag(e,true));
thumb.addEventListener('click',e=>{
 if(suppressClick&&e.detail!==0){e.preventDefault();return;}
 if(!ownAttendance())chooseAttendance('offline');
});
thumb.addEventListener('keydown',e=>{
 if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
  e.preventDefault();resetDrag();chooseAttendance(e.key==='ArrowLeft'?'offline':'online');
 }else if(e.key==='Escape'&&drag){suppressClick=true;const id=drag.id;resetDrag();if(thumb.hasPointerCapture(id))thumb.releasePointerCapture(id);}
});
$('#dialog').addEventListener('close',()=>{pendingRight=false;renderAttendanceStatus();});
window.addEventListener('blur',()=>{if(drag){suppressClick=true;resetDrag();}});
window.addEventListener('resize',()=>{if(drag)suppressClick=true;resetDrag();});
new ResizeObserver(()=>{if(!drag)syncThumb();}).observe(track);
renderProfile();renderEvents();renderPeople();
sidebarClose.addEventListener('click',()=>menu(false));
$('#dialog-form').addEventListener('submit',e=>{
 if(dialogMode!=='other')return;
 e.preventDefault();
 e.stopImmediatePropagation();
 const names=[...e.target.querySelectorAll('input[name="otherPeople"]:checked')].map(input=>input.value);
 if(!names.length){notify('Pilih minimal satu jamaah.');return;}
 const status=e.target.querySelector('[name="status"]').value;
 names.forEach(name=>attend(status,name,false));
 $('#dialog').close();
 notify(`${names.length} jamaah berhasil diabsen.`);
},true);

initializeFeatures();
