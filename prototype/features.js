// Activity details and class pages. All demo records stay on this device.
const CLASS_NAMES=['Umum','Bapak-bapak','Ibu-ibu','Keputrian','Remaja','Pra Remaja','Caberawit','Paud'];
const MATERIAL_NAMES=['Al-Quran','Hadist','CAI','Nasehat','Asad','Lainnya'];
function materialText(m){
 let text=m.type==='Lainnya'?m.text:m.type;
 if(m.type==='Al-Quran')text=`Al-Quran ${m.surah}:${m.verse}`;
 if(m.type==='Hadist')text=`Hadist${m.book?' '+m.book:''} Hal. ${m.page}`;
 if(m.type==='CAI')text=`CAI Hal. ${m.page}`;
 return text+(m.note?.trim()?` (${m.note.trim()})`:'');
}
function eventStatus(e,now=Date.now()){
 const buffer=2*60*60*1000;
 const start=new Date(`${e.date}T${e.start}`).getTime()-buffer;
 const end=new Date(`${e.date}T${e.end}`).getTime()+buffer;
 return now<start?'Belum dimulai':now>end?'Selesai':'Sedang berlangsung';
}
function eventFields(){
 const today=new Date();const date=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
 return field('Nama kegiatan','title')+field('Lokasi','location')+
 '<div class="form-columns"><label>Level<select name="level"><option>Desa</option><option>Daerah</option><option>Kelompok</option></select></label><label>Kelas<input name="className" list="class-options" placeholder="Pilih atau ketik kelas" required maxlength="60"><datalist id="class-options">'+CLASS_NAMES.map(c=>`<option value="${c}"></option>`).join('')+'</datalist></label></div>'+
 field('Tanggal','date','date',date)+'<div class="form-columns">'+field('Waktu mulai','start','time','20:00')+field('Waktu selesai','end','time','21:30')+'</div>'+
 '<fieldset class="materials-field"><legend>Materi kegiatan</legend><p class="muted">Centang materi yang akan disampaikan.</p>'+MATERIAL_NAMES.map((type,i)=>`<div class="material-option"><label class="material-check"><input type="checkbox" data-material="${type}" data-index="${i}">${type}</label><div class="material-inputs" data-details="${i}" hidden></div></div>`).join('')+'</fieldset>'+
 '<label>Link Zoom (opsional)<input name="zoomUrl" type="url" maxlength="500" placeholder="https://zoom.us/j/…"></label><label>Keterangan<textarea name="note" rows="2" maxlength="500" placeholder="Informasi kegiatan lainnya (opsional)"></textarea></label>';
}
function setupEventForm(){
 $('#dialog').classList.add('event-dialog');
 document.querySelectorAll('[data-material]').forEach(check=>check.addEventListener('change',()=>{
  const box=document.querySelector(`[data-details="${check.dataset.index}"]`),type=check.dataset.material;
  box.hidden=!check.checked;
  const number=(label,key,max='')=>`<label>${label}<input type="number" data-key="${key}" min="1" ${max?`max="${max}"`:''} step="1" required></label>`;
  if(!check.checked){box.innerHTML='';return;}
  box.innerHTML=type==='Al-Quran'?number('Nomor surat','surah',114)+number('Nomor ayat','verse',286):type==='Hadist'?'<label>Nama kitab (opsional)<input data-key="book" maxlength="80" placeholder="Contoh: K.Sholah"></label>'+number('Halaman','page'):type==='CAI'?number('Halaman','page'):type==='Lainnya'?'<label>Materi lainnya<input data-key="text" required maxlength="160" placeholder="Contoh: Ramah tamah"></label>':'';
  box.insertAdjacentHTML('beforeend',`<label class="material-comment">Keterangan ${type} (opsional)<input data-key="note" maxlength="200" placeholder="Contoh: materi kedalam"></label>`);
 }));
}
function saveEventForm(form){
 const data=Object.fromEntries(new FormData(form));
 Object.keys(data).forEach(key=>data[key]=data[key].trim());
 if(!data.title||!data.location||!data.className){notify('Lengkapi nama, lokasi, dan kelas kegiatan.');return;}
 if(data.end<=data.start){notify('Waktu selesai harus setelah waktu mulai.');return;}
 if(data.zoomUrl&&!safeZoomUrl(data.zoomUrl)){notify('Gunakan link HTTPS Zoom yang valid.');return;}
 const materials=[...form.querySelectorAll('[data-material]:checked')].map(check=>{
  const item={type:check.dataset.material};
  form.querySelectorAll(`[data-details="${check.dataset.index}"] [data-key]`).forEach(input=>item[input.dataset.key]=input.value.trim());return item;
 });
 if(!materials.length){notify('Pilih minimal satu materi.');return;}
 if(materials.some(m=>m.type==='Lainnya'&&!m.text)){notify('Isi nama materi lainnya.');return;}
 if(editingAgendaId){
  const event=state.events.find(e=>e.id===editingAgendaId);
  if(!event){notify('Kegiatan tidak ditemukan.');return;}
  const dateChanged=event.date!==data.date;
  Object.assign(event,data,{materials,material:materials.map(materialText).join(', ')});
  if(dateChanged)event.fixedDemoDate=true;
  save();renderEvents();renderSchedule();$('#dialog').close();notify('Kegiatan berhasil diperbarui.');return;
 }
 const id='event-'+Date.now();
 state.events.push({...data,id,icon:'users',materials,material:materials.map(materialText).join(', ')});
 state.people[id]=[];state.selected=id;save();renderEvents();renderPeople();renderSchedule();$('#dialog').close();notify('Kegiatan baru berhasil dibuat.');
}
function renderActivityCards(){
 const active=state.events.filter(e=>eventStatus(e)==='Sedang berlangsung');
 if(!active.some(e=>e.id===state.selected))state.selected=active[0]?.id||null;
 $('#attendance-page .workspace').hidden=!active.length;
 $('#events').innerHTML=active.map(e=>{
  const status=eventStatus(e),materials=e.materials?.map(materialText).join(', ')||e.material;
  return `<button class="event-card ${e.id===state.selected?'selected':''}" data-event="${escapeHTML(e.id)}" aria-pressed="${e.id===state.selected}"><span class="event-icon">${icon(e.icon==='moon'?'moon':'users')}</span><div class="event-heading"><h2 class="event-title">${escapeHTML(e.title)}</h2></div><span class="selection-mark">${e.id===state.selected?icon('check'):''}</span><span class="event-labels"><span class="badge">${escapeHTML(e.level)}</span><span class="badge class-badge">${escapeHTML(e.className||'Umum')}</span><span class="status-marquee ${status==='Sedang berlangsung'?'is-live':status==='Selesai'?'is-finished':''}" aria-label="${status}"><span aria-hidden="true">${status}</span></span></span><span class="event-detail">${icon('pin')}<span>${escapeHTML(e.location)}</span></span><span class="event-detail">${icon('calendar')}<span>${escapeHTML(dateLabel(e.date))}. ${escapeHTML(e.start)} - ${escapeHTML(e.end)}</span></span><span class="event-detail event-material">${icon('book')}<span><b>Materi</b><span>${escapeHTML(materials||'Belum diisi')}</span></span></span>${e.note?.trim()?`<span class="event-note"><b>Keterangan</b><span>${escapeHTML(e.note.trim())}</span></span>`:''}</button>`;
 }).join('')||'<div class="empty-events">Tidak ada kegiatan yang sedang berlangsung. Lihat seluruh kegiatan di menu Jadwal AMI.</div>';
 $('#event-dots').innerHTML=active.map(e=>`<span class="${e.id===state.selected?'active':''}"></span>`).join('');$('#selected-event').textContent=selected()?.title||'';renderAttendanceStatus();renderPeople();
}
function classOptions(){return ['Semua kelas',...new Set([...CLASS_NAMES,...state.events.map(e=>e.className||'Umum')])].map(c=>`<option>${escapeHTML(c)}</option>`).join('');}
function safeZoomUrl(value){
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&(url.hostname==='zoom.us'||url.hostname.endsWith('.zoom.us'))?url.href:'';}catch{return '';}
}
function renderZoomLink(){
 let box=$('#zoom-access');
 if(!box){box=document.createElement('div');box.id='zoom-access';box.className='zoom-access';$('#attendance-feedback').after(box);}
 const current=ownAttendance();
 box.hidden=!current||!['online','izin'].includes(current.status);
 if(box.hidden){box.replaceChildren();return;}
 const url=safeZoomUrl(selected()?.zoomUrl);
 box.innerHTML=`<a class="zoom-button" href="${escapeHTML(url||'https://zoom.us/join')}" target="_blank" rel="noopener noreferrer">${icon('screen')}${url?'Gabung Zoom':'Buka Zoom'}</a>${url?'':'<small>Link rapat belum diatur. Masukkan ID rapat di halaman Zoom.</small>'}`;
}
function initializeFeatures(){
 state.events.forEach(e=>{
  e.className ||= e.id==='youth'?'Remaja':'Umum';e.materialNote ||= '';e.note ||= '';
  if(e.material==='Al-Quran (surat x ayat x), Hadist, Nasehat')e.material='Al-Quran x:x, Hadist, Nasehat';
  if(e.material==='Hadist K.Sholah (hal 8), Nasehat, Asad')e.material='Hadist K.Sholah Hal. 8, Nasehat, Asad';
 });
 state.donations ||= [];
 const nav=$('#sidebar nav');
 const primaryNav=[['schedule','calendar','AMI'],['attendance','circle-check','Absen'],['donations','users','Shodakoh']];
 const primaryButtons=primaryNav.map(([page,symbol,label])=>`<button class="nav-item primary-nav-item${page==='attendance'?' active':''}" data-page="${page}"${page==='attendance'?' aria-current="page"':''}>${icon(symbol)}<span>${label}</span></button>`).join('');
 nav.innerHTML=primaryButtons+`<button class="nav-item" data-page="history">${icon('history')}Riwayat Absen</button><button class="nav-item" data-page="classes">${icon('book')}Kelas</button>`;
 document.body.insertAdjacentHTML('beforeend',`<nav class="mobile-bottom-nav" aria-label="Navigasi utama mobile">${primaryButtons}</nav>`);
 $('main footer').insertAdjacentHTML('beforebegin','<section id="classes-page" class="feature-page" aria-label="Kelas" hidden></section>');
 $('main footer').insertAdjacentHTML('beforebegin',`<section id="schedule-page" class="feature-page panel" hidden><div class="feature-toolbar"><h2>Seluruh kegiatan</h2><button class="primary-button" id="schedule-create">＋ Tambah kegiatan</button></div><div class="schedule-scroll" tabindex="0" role="region" aria-label="Tabel Jadwal AMI"><table class="schedule-table"><thead><tr><th>Kegiatan</th><th>Level / Kelas</th><th>Tanggal &amp; Jam</th><th>Lokasi</th><th>Materi</th><th>Keterangan</th><th>Status</th></tr></thead><tbody id="schedule-rows"></tbody></table></div></section><section id="donations-page" class="feature-page" hidden><div class="donation-grid">${['Kelompok 1','Kelompok 2','Kelompok 3','Desa'].map((name,i)=>`<article class="panel donation-card"><h2>${name}</h2><span class="demo-payment">DATA DUMMY · BUKAN UNTUK TRANSFER</span><dl><dt>Bank</dt><dd>Bank Contoh</dd><dt>Nomor rekening</dt><dd>0000 0000 000${i+1}</dd><dt>Atas nama</dt><dd>Bendahara ${name} (Demo)</dd></dl><div class="qris-placeholder"><div class="qris-demo-art" aria-hidden="true">${icon('qr-demo')}</div><strong>QRIS ${name}</strong><span>Contoh tampilan — tidak dapat dipindai</span></div></article>`).join('')}</div></section><section id="progress-page" class="feature-page panel" hidden><div class="feature-toolbar"><label>Kelas<select id="progress-class">${classOptions()}</select></label><span id="meeting-count" class="metric"></span></div><p class="muted">Materi dari kegiatan yang sudah Anda hadiri secara offline atau online. Setiap kegiatan dihitung satu pertemuan.</p><div id="progress-list"></div></section><section id="class-donations-page" class="feature-page panel" hidden><div class="feature-toolbar"><label>Kategori<select id="donation-category"><option value="all">Semua kategori</option><option>Kas</option><option>Tabungan Jalan-jalan</option></select></label><button class="primary-button" id="add-donation">＋ Catat shodakoh</button></div><p class="muted">Catatan shodakoh pribadi di perangkat ini, bukan konfirmasi pembayaran.</p><div id="donation-summary" class="metric"></div><div id="donation-history"></div></section>`);
 document.querySelectorAll('[data-page]').forEach(button=>button.onclick=()=>showFeaturePage(button.dataset.page));
 initializeAgenda();
 $('#schedule-create').onclick=()=>openDialog('event');
 $('#progress-class').onchange=renderProgress;
 $('#donation-category').onchange=renderDonations;
 $('#add-donation').onclick=()=>{
  dialogMode='donation';$('#dialog-title').textContent='Catat shodakoh';$('#dialog-fields').innerHTML='<label>Kategori<select name="category"><option>Kas</option><option>Tabungan Jalan-jalan</option></select></label><label>Kelas<select name="className">'+CLASS_NAMES.map(c=>`<option>${c}</option>`).join('')+'</select></label><label>Jumlah (Rp)<input name="amount" type="number" min="1" max="1000000000" step="1" required></label>'+field('Tanggal','date','date',new Date().toLocaleDateString('en-CA'))+'<label>Keterangan (opsional)<input name="note" maxlength="160"></label>';$('#dialog').showModal();
 };
 $('#dialog-form').addEventListener('submit',e=>{
  if(dialogMode!=='event'&&dialogMode!=='donation')return;
  e.preventDefault();e.stopImmediatePropagation();
  if(dialogMode==='event'){saveEventForm(e.target);return;}
  const data=Object.fromEntries(new FormData(e.target));const amount=Number(data.amount);
  if(!Number.isSafeInteger(amount)||amount<=0||amount>1000000000){notify('Masukkan jumlah yang valid.');return;}
  state.donations.push({...data,amount,id:Date.now()});save();renderDonations();$('#dialog').close();notify('Catatan shodakoh disimpan.');
 },true);
 $('#dialog').addEventListener('close',()=>$('#dialog').classList.remove('event-dialog'));
 renderEvents();
 setInterval(()=>{
  const datesChanged=refreshDemoDates();
  const visible=[...document.querySelectorAll('.event-card')].map(card=>card.dataset.event).join('|');
  const active=state.events.filter(e=>eventStatus(e)==='Sedang berlangsung').map(e=>e.id).join('|');
  if(datesChanged||visible!==active)renderEvents();
  if(!$('#schedule-page').hidden)renderSchedule();
 },30000);
}
function showFeaturePage(page){
 const titles={schedule:['AMI',''],classes:['Kelas',''],attendance:['Absen','Pilih kegiatan, lalu klik untuk absensi.'],history:['Riwayat Absen','Catatan kehadiran dalam kegiatan Anda.'],donations:['Shodakoh','Rekening dan QRIS kelompok serta desa.'],progress:['Ketercapaian Materi','Materi yang sudah didapatkan dan jumlah pertemuan.'],'class-donations':['Shodakoh Kelas','Riwayat Kas dan Tabungan Jalan-jalan.']};
 Object.keys(titles).forEach(key=>$('#'+key+'-page').hidden=key!==page);
 $('#page-title').textContent=titles[page][0];$('#page-description').textContent=titles[page][1];
 document.querySelectorAll('[data-page]').forEach(b=>{const active=b.dataset.page===page;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 if(page==='schedule')renderSchedule();if(page==='attendance')renderEvents();if(page==='history')renderHistory();if(page==='progress'){const selectedClass=$('#progress-class').value;$('#progress-class').innerHTML=classOptions();$('#progress-class').value=selectedClass;renderProgress();}if(page==='class-donations')renderDonations();menu(false);
}
function renderProgress(){
 const cls=$('#progress-class').value;
 const events=state.events.filter(e=>(cls==='Semua kelas'||e.className===cls)&&(state.people[e.id]||[]).some(p=>p.id==='self'&&(p.status==='offline'||p.status==='online'))).sort((a,b)=>b.date.localeCompare(a.date));
 $('#meeting-count').textContent=`${events.length} pertemuan`;
 $('#progress-list').innerHTML=events.map(e=>`<article class="progress-row"><span class="badge class-badge">${escapeHTML(e.className)}</span><h3>${escapeHTML(e.title)}</h3><p>${escapeHTML(e.materials?.map(materialText).join(', ')||e.material)}</p><small>${escapeHTML(dateLabel(e.date))}</small></article>`).join('')||'<p class="empty">Belum ada materi yang didapatkan di kelas ini. Catat kehadiran pada kegiatan terlebih dahulu.</p>';
}
function renderDonations(){
 const category=$('#donation-category').value;const records=state.donations.filter(d=>category==='all'||d.category===category).sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
 const money=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
 $('#donation-summary').textContent=`Total tercatat: ${money(records.reduce((sum,d)=>sum+d.amount,0))}`;
 $('#donation-history').innerHTML=records.map(d=>`<article class="progress-row donation-row"><div><h3>${escapeHTML(d.category)}</h3><p>${escapeHTML(d.className)} · ${escapeHTML(dateLabel(d.date))}</p>${d.note?`<small>${escapeHTML(d.note)}</small>`:''}</div><strong>${money(d.amount)}</strong></article>`).join('')||'<p class="empty">Belum ada riwayat shodakoh untuk kategori ini.</p>';
}
