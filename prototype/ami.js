'use strict';
let editingAgendaId=null;
let agendaPage=0, agendaDescending=false, readingEvents=[], readingIndex=0;
function initializeAgenda(){
 const page=$('#schedule-page');page.classList.remove('panel');
 page.innerHTML=`<div class="dt-toolbar"><label>Tampilkan <select id="ami-size"><option>10</option><option selected>25</option><option>50</option><option>100</option></select> baris</label><button id="ami-copy-table">Copy</button><button id="ami-print">PDF / Cetak</button><button id="schedule-create" class="dt-add">＋ Tambah</button><label class="dt-search">Cari: <input type="search" id="ami-search" placeholder="Cari kegiatan..." aria-label="Cari agenda"></label></div><div id="ami-results"></div><div class="dt-footer"><span id="ami-info" role="status"></span><div><button id="ami-page-prev">Sebelumnya</button><span id="ami-page-number"></span><button id="ami-page-next">Berikutnya</button></div></div><div class="dt-selection"><span>Klik / tap dua kali pada baris untuk edit atau hapus.</span><button id="ami-share">Bagikan WA</button><button id="ami-read">Mode baca</button></div>`;
 document.body.insertAdjacentHTML('beforeend',`<dialog id="ami-dialog" class="ami-dialog"><div class="dialog-heading"><h2 id="ami-dialog-title"></h2><button class="close-button" id="ami-close" aria-label="Tutup agenda">×</button></div><div id="ami-dialog-content"></div></dialog>`);
 $('#ami-search').oninput=()=>{agendaPage=0;renderSchedule();};
 $('#ami-size').onchange=()=>{agendaPage=0;renderSchedule();};
 $('#ami-page-prev').onclick=()=>{agendaPage--;renderSchedule();};
 $('#ami-page-next').onclick=()=>{agendaPage++;renderSchedule();};
 $('#ami-results').onclick=e=>{if(e.target.closest('#ami-sort-date')){agendaDescending=!agendaDescending;agendaPage=0;renderSchedule();}};
 $('#ami-share').onclick=()=>openAgendaShare(filteredAgenda());
 $('#ami-read').onclick=()=>{readingEvents=filteredAgenda();readingIndex=0;renderAgendaReader();$('#ami-dialog').showModal();};
 $('#ami-copy-table').onclick=async()=>{const text=agendaShareText(filteredAgenda());try{await navigator.clipboard.writeText(text);notify('Agenda hasil pencarian disalin.');}catch{openAgendaShare(filteredAgenda());}};
 $('#ami-print').onclick=()=>window.print();
 $('#ami-close').onclick=()=>$('#ami-dialog').close();
 $('#ami-results').ondblclick=e=>{const row=e.target.closest('[data-edit-event]');if(row)openAgendaEditor(row.dataset.editEvent);};
 let lastTap=null, touchStart=null;
 $('#ami-results').addEventListener('pointerdown',e=>{if(e.pointerType==='touch')touchStart={x:e.clientX,y:e.clientY};});
 $('#ami-results').addEventListener('pointerup',e=>{
  if(e.pointerType!=='touch'||!touchStart)return;
  const row=e.target.closest('[data-edit-event]'),moved=Math.hypot(e.clientX-touchStart.x,e.clientY-touchStart.y);touchStart=null;
  if(!row||moved>12){lastTap=null;return;}
  const now=Date.now();if(lastTap&&lastTap.id===row.dataset.editEvent&&now-lastTap.time<350){lastTap=null;e.preventDefault();openAgendaEditor(row.dataset.editEvent);}else lastTap={id:row.dataset.editEvent,time:now};
 });
 $('#ami-results').onkeydown=e=>{if(e.key==='Enter'&&e.target.matches('[data-edit-event]'))openAgendaEditor(e.target.dataset.editEvent);};
 $('#dialog').addEventListener('close',()=>{editingAgendaId=null;$('#agenda-delete')?.remove();});
 renderSchedule();
}
function agendaItems(){return [...state.events].sort((a,b)=>(agendaDescending?-1:1)*(a.date+a.start).localeCompare(b.date+b.start)||a.title.localeCompare(b.title));}
function filteredAgenda(){const query=$('#ami-search').value.trim().toLocaleLowerCase('id');return agendaItems().filter(e=>[e.title,e.location,e.date,agendaDate(e),e.start,e.end,e.level,e.className,agendaMaterials(e).join(' '),e.note,eventStatus(e)].join(' ').toLocaleLowerCase('id').includes(query));}
function pageAgenda(){const size=Number($('#ami-size').value);return filteredAgenda().slice(agendaPage*size,(agendaPage+1)*size);}
function agendaMaterials(e){return e.materials?.length?e.materials.map(materialText):[e.material||'Belum ditentukan'];}
function agendaDate(e){return new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(e.date+'T12:00:00'));}
function agendaDuration(e){const minutes=t=>{const [h,m]=t.split(':').map(Number);return h*60+m;};let duration=minutes(e.end)-minutes(e.start);return duration<0?duration+1440:duration;}
function renderSchedule(){
 if(!$('#ami-results'))return;
 const all=filteredAgenda(),size=Number($('#ami-size').value),pages=Math.max(1,Math.ceil(all.length/size));agendaPage=Math.max(0,Math.min(agendaPage,pages-1));
 const events=pageAgenda();let previous='';
 const rows=events.map(e=>{let dateCell='';if(previous!==e.date){previous=e.date;dateCell=`<td class="dt-date" rowspan="${events.filter(item=>item.date===e.date).length}">${escapeHTML(agendaDate(e))}</td>`;}
 return `<tr data-edit-event="${escapeHTML(e.id)}" tabindex="0" aria-label="Edit ${escapeHTML(e.title)}">${dateCell}<td class="dt-time">${escapeHTML(e.start)}<br>– ${escapeHTML(e.end)}</td><td class="dt-duration">${agendaDuration(e)}</td><td><strong>${escapeHTML(e.title)}</strong><div class="dt-tags"><span>${escapeHTML(e.level)}</span><span>${escapeHTML(e.className||'Umum')}</span></div></td><td><b>Lokasi:</b><p>${escapeHTML(e.location)}</p><b>Materi:</b><p>${escapeHTML(agendaMaterials(e).join(', '))}</p>${e.note?'<b>Keterangan:</b><p>'+escapeHTML(e.note)+'</p>':''}</td><td><span class="dt-status ${eventStatus(e)==='Sedang berlangsung'?'live':''}">${escapeHTML(eventStatus(e))}</span></td></tr>`;
 }).join('');
 $('#ami-results').innerHTML=`<div class="dt-scroll" tabindex="0" role="region" aria-label="Tabel agenda AMI"><table class="ami-datatable"><thead><tr><th aria-sort="${agendaDescending?'descending':'ascending'}"><button id="ami-sort-date">Tanggal ${agendaDescending?'↓':'↑'}</button></th><th>Jam</th><th>Durasi<br>(menit)</th><th>Agenda</th><th>Rincian</th><th>Status</th></tr></thead><tbody>${rows||'<tr><td colspan="6" class="empty">Tidak ada kegiatan yang cocok.</td></tr>'}</tbody></table></div>`;
 $('#ami-info').textContent=`Menampilkan ${all.length?agendaPage*size+1:0}–${Math.min((agendaPage+1)*size,all.length)} dari ${all.length} kegiatan`;
 $('#ami-page-number').textContent=` ${agendaPage+1} / ${pages} `;
 $('#ami-page-prev').disabled=agendaPage===0;$('#ami-page-next').disabled=agendaPage===pages-1;$('#ami-share').disabled=$('#ami-read').disabled=!all.length;
}
function agendaShareText(events){return '*AGENDA PENGAJIAN*\n\n'+events.map(e=>`${agendaDate(e)}\n*${e.title}*\nLokasi: ${e.location}\nWaktu: ${e.start}–${e.end}\n${e.level} · ${e.className||'Umum'}\n\nMateri:\n${agendaMaterials(e).map(m=>'• '+m).join('\n')}${e.note?'\n\nKeterangan: '+e.note:''}`).join('\n\n────────────\n\n');}
function openAgendaShare(events){
 $('#ami-dialog-title').textContent='Bagikan agenda';
 $('#ami-dialog-content').innerHTML='<label class="ami-preview-label" for="ami-share-text">Teks pengumuman (bisa diedit)</label><textarea id="ami-share-text" rows="14"></textarea><div class="dialog-actions"><button class="secondary-button" id="ami-copy">Salin teks</button><a class="primary-button" id="ami-whatsapp" target="_blank" rel="noopener noreferrer">Buka WhatsApp</a></div>';
 const input=$('#ami-share-text');input.value=agendaShareText(Array.isArray(events)?events:filteredAgenda());
 const update=()=>$('#ami-whatsapp').href='https://wa.me/?text='+encodeURIComponent(input.value);update();input.oninput=update;
 $('#ami-copy').onclick=async()=>{try{await navigator.clipboard.writeText(input.value);notify('Teks agenda berhasil disalin.');}catch{input.focus();input.select();notify('Teks dipilih. Gunakan Salin pada perangkat Anda.');}};
 $('#ami-dialog').showModal();
}
function renderAgendaReader(){
 const e=readingEvents[readingIndex];if(!e)return;
 $('#ami-dialog-title').textContent=`Mode baca · ${readingIndex+1} / ${readingEvents.length}`;
 $('#ami-dialog-content').innerHTML=`<article class="ami-reader"><p class="ami-reader-date">${escapeHTML(agendaDate(e))}</p><h3>${escapeHTML(e.title)}</h3><p>Kegiatan ${escapeHTML(e.level)} untuk kelas ${escapeHTML(e.className||'Umum')} dilaksanakan di <strong>${escapeHTML(e.location)}</strong>, pukul <strong>${escapeHTML(e.start+' sampai '+e.end)}</strong>.</p><h4>Materi yang disampaikan:</h4><ul>${agendaMaterials(e).map(m=>'<li>'+escapeHTML(m)+'</li>').join('')}</ul>${e.note?'<p>'+escapeHTML(e.note)+'</p>':''}</article><div class="dialog-actions"><button class="secondary-button" id="ami-prev" ${readingIndex===0?'disabled':''}>← Sebelumnya</button><button class="primary-button" id="ami-next" ${readingIndex===readingEvents.length-1?'disabled':''}>Berikutnya →</button></div>`;
 $('#ami-prev').onclick=()=>{readingIndex--;renderAgendaReader();$('#ami-dialog').scrollTop=0;};$('#ami-next').onclick=()=>{readingIndex++;renderAgendaReader();$('#ami-dialog').scrollTop=0;};
}

function openAgendaEditor(id){
 if($('#dialog').open)return;
 const event=state.events.find(e=>e.id===id);if(!event)return;
 openDialog('event');editingAgendaId=id;$('#dialog-title').textContent='Edit kegiatan';
 const form=$('#dialog-form');
 ['title','location','level','className','date','start','end','zoomUrl','note'].forEach(key=>{form.elements.namedItem(key).value=event[key]||(key==='className'?'Umum':'');});
 const materials=event.materials?.length?event.materials:[{type:'Lainnya',text:event.material||'Belum ditentukan'}];
 materials.forEach(material=>{
  const check=[...form.querySelectorAll('[data-material]')].find(input=>input.dataset.material===material.type);if(!check)return;
  check.checked=true;check.dispatchEvent(new Event('change'));
  form.querySelectorAll('[data-details="'+check.dataset.index+'"] [data-key]').forEach(input=>input.value=material[input.dataset.key]||'');
 });
 form.querySelector('.dialog-actions').insertAdjacentHTML('afterbegin','<button type="button" id="agenda-delete" class="secondary-button danger-button">Hapus kegiatan</button>');
 $('#agenda-delete').onclick=()=>{
  if(!confirm('Hapus kegiatan "'+event.title+'" di '+event.location+'?'))return;
  state.deletedEvents ||= [];state.deletedEvents.push({...event,deletedAt:Date.now()});
  state.events=state.events.filter(e=>e.id!==id);
  if(state.selected===id)state.selected=null;
  save();renderEvents();renderSchedule();$('#dialog').close();notify('Kegiatan dihapus dari agenda.');
 };
}
