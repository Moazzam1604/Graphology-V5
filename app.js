const $ = id => document.getElementById(id);
const cfg = window.WRITEWISE_CONFIG || {};
const configured = cfg.supabaseUrl && cfg.supabaseAnonKey && !cfg.supabaseUrl.startsWith('PASTE_');
const db = configured ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
let selectedBlob = null;
let selectedPreview = '';
let deferredPrompt = null;
let activeCustomer = localStorage.getItem('writewise_customer_name') || '';
let activeCode = localStorage.getItem('writewise_access_code') || '';

const toast = message => { $('toast').textContent=message; $('toast').classList.remove('hidden'); clearTimeout(window.__t); window.__t=setTimeout(()=>$('toast').classList.add('hidden'),3500); };
const safe = value => String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const formatDate = iso => iso ? new Date(iso).toLocaleString() : '';
const setView = id => ['homeView','customerView','adminLoginView','adminView'].forEach(v=>$(v).classList.toggle('hidden',v!==id));
const imageUrl = path => db.storage.from('handwriting').getPublicUrl(path).data.publicUrl;

function randomCode(){ return 'WW-'+crypto.getRandomValues(new Uint32Array(2)).join('-').toUpperCase(); }
$('customerNameInput').value=activeCustomer; $('accessCodeInput').value=activeCode;
$('generateCodeBtn').onclick=()=>{ activeCode=randomCode(); $('accessCodeInput').value=activeCode; toast('New private access code generated. Save it safely.'); };

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBtn').classList.remove('hidden');});
$('installBtn').onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installBtn').classList.add('hidden');};

$('customerBtn').onclick=async()=>{
  if(!configured) return toast('Complete config.js first. Open README-FIRST.txt.');
  const name=$('customerNameInput').value.trim(), code=$('accessCodeInput').value.trim();
  if(name.length<2) return toast('Please enter your name.');
  if(code.length<8) return toast('Generate or enter your private access code.');
  activeCustomer=name;activeCode=code;localStorage.setItem('writewise_customer_name',name);localStorage.setItem('writewise_access_code',code);
  $('customerName').textContent=name;setView('customerView');await renderCustomer();
};
$('adminBtn').onclick=()=>{$('adminPinInput').value='';setView('adminLoginView');};
$('customerHomeBtn').onclick=$('adminBackBtn').onclick=$('adminHomeBtn').onclick=()=>setView('homeView');
$('adminLoginBtn').onclick=async()=>{if(!configured)return toast('Complete config.js first.');if($('adminPinInput').value!==cfg.adminKey)return toast('Incorrect admin key.');setView('adminView');await renderAdmin();};
$('changePinBtn').onclick=()=>toast('Change adminKey in config.js and the matching secret in setup.sql, then rerun SQL functions.');

$('imageInput').onchange=async e=>{
 const file=e.target.files[0]; if(!file)return;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)){e.target.value='';return toast('Choose a JPG, PNG or WEBP image.');}
 try{selectedBlob=await compressImage(file,1600,.78);if(selectedPreview)URL.revokeObjectURL(selectedPreview);selectedPreview=URL.createObjectURL(selectedBlob);$('preview').src=selectedPreview;$('preview').classList.remove('hidden');updateSubmitState();}catch{toast('Unable to read this image.');}
};
$('consentCheck').onchange=updateSubmitState;
function updateSubmitState(){$('uploadBtn').disabled=!(selectedBlob&&$('consentCheck').checked);}

$('uploadBtn').onclick=async()=>{
 if(!selectedBlob||!activeCode)return;
 $('uploadBtn').disabled=true;$('uploadBtn').textContent='Uploading…';
 const path=`${crypto.randomUUID()}.jpg`;
 try{
  const up=await db.storage.from('handwriting').upload(path,selectedBlob,{contentType:'image/jpeg',upsert:false});if(up.error)throw up.error;
  const res=await db.rpc('create_submission',{p_access_code:activeCode,p_customer_name:activeCustomer,p_customer_note:$('customerNote').value.trim(),p_image_path:path});
  if(res.error){await db.storage.from('handwriting').remove([path]);throw res.error;}
  selectedBlob=null;if(selectedPreview)URL.revokeObjectURL(selectedPreview);selectedPreview='';$('imageInput').value='';$('preview').classList.add('hidden');$('customerNote').value='';$('consentCheck').checked=false;
  toast('Uploaded successfully. Keep your access code safe.');await renderCustomer();
 }catch(err){toast(`Upload failed: ${err.message||'Please retry.'}`);}finally{$('uploadBtn').textContent='Submit for Assessment';updateSubmitState();}
};

async function renderCustomer(){
 $('customerName').textContent=activeCustomer;$('reportStatusText').textContent='Loading…';
 const {data,error}=await db.rpc('customer_submissions',{p_access_code:activeCode});
 if(error){$('reportStatusText').textContent='Unable to load submissions.';return toast(error.message);}
 const rows=data||[],latest=rows[0];
 if(!latest){$('reportStatusText').textContent='No submission yet.';$('reportBox').classList.add('hidden');}
 else if(latest.status==='completed'){$('reportStatusText').textContent='Your report is ready.';$('reportBox').innerHTML=`<h3>Manual assessment report</h3><p>${safe(latest.report_text).replace(/\n/g,'<br>')}</p><small>Completed ${formatDate(latest.reviewed_at)}</small>`;$('reportBox').classList.remove('hidden');}
 else{$('reportStatusText').textContent='Your handwriting is awaiting manual review.';$('reportBox').classList.add('hidden');}
 $('customerHistory').innerHTML=rows.length?rows.map(x=>`<div class="history-item"><strong>${x.status==='completed'?'✅ Report ready':'🕒 Awaiting review'}</strong><span>${formatDate(x.created_at)}</span></div>`).join(''):'<p class="muted">No submissions yet.</p>';
}

async function renderAdmin(){
 $('adminQueue').innerHTML='<div class="queue-card empty-state">Loading submissions…</div>';
 const {data,error}=await db.rpc('admin_submissions',{p_admin_key:cfg.adminKey});
 if(error){$('adminQueue').innerHTML='<div class="queue-card empty-state">Unable to load.</div>';return toast(error.message);}
 const rows=data||[];if(!rows.length){$('adminQueue').innerHTML='<div class="queue-card empty-state">📭 No submissions yet.</div>';return;}
 $('adminQueue').innerHTML=rows.map(x=>`<article class="queue-card"><img src="${imageUrl(x.image_path)}" alt="Handwriting sample" loading="lazy"><h3>${safe(x.customer_name)}</h3><div class="queue-meta">${formatDate(x.created_at)} · ${x.status==='completed'?'Completed':'Pending review'}</div><p><strong>Customer note:</strong> ${safe(x.customer_note||'None')}</p><textarea id="report-${x.id}" placeholder="Write the manual assessment report…">${safe(x.report_text||'')}</textarea><div class="admin-actions"><button class="primary-btn" data-publish="${x.id}">${x.status==='completed'?'Update Report':'Publish Report'}</button><button class="danger-btn" data-delete="${x.id}" data-path="${safe(x.image_path)}">Delete</button></div></article>`).join('');
 document.querySelectorAll('[data-publish]').forEach(b=>b.onclick=async()=>{const text=$(`report-${b.dataset.publish}`).value.trim();if(text.length<40)return toast('Write at least 40 characters.');const r=await db.rpc('publish_report',{p_admin_key:cfg.adminKey,p_id:b.dataset.publish,p_report:text});if(r.error)return toast(r.error.message);toast('Report published.');await renderAdmin();});
 document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this submission permanently?'))return;const r=await db.rpc('delete_submission',{p_admin_key:cfg.adminKey,p_id:b.dataset.delete});if(r.error)return toast(r.error.message);if(r.data)await db.storage.from('handwriting').remove([r.data]);toast('Submission deleted.');await renderAdmin();});
}

$('exportBtn').onclick=async()=>{const {data,error}=await db.rpc('admin_submissions',{p_admin_key:cfg.adminKey});if(error)return toast(error.message);const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({exportedAt:new Date().toISOString(),submissions:data},null,2)],{type:'application/json'}));a.download=`writewise-cloud-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);};
$('importInput').onchange=()=>toast('Cloud import is intentionally disabled to prevent accidental overwrites.');

function compressImage(file,maxSide,quality){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{let {width,height}=img;const scale=Math.min(1,maxSide/Math.max(width,height));width=Math.round(width*scale);height=Math.round(height*scale);const c=document.createElement('canvas');c.width=width;c.height=height;c.getContext('2d').drawImage(img,0,0,width,height);URL.revokeObjectURL(img.src);c.toBlob(blob=>blob?resolve(blob):reject(new Error('Compression failed')),'image/jpeg',quality);};img.onerror=reject;img.src=URL.createObjectURL(file);});}
if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
if(!activeCode){activeCode=randomCode();$('accessCodeInput').value=activeCode;}
