let patients = JSON.parse(localStorage.getItem('patients')) || [];
let currentPatientId = null;

// ذخیره در localStorage
function saveToLocal() {
  localStorage.setItem('patients', JSON.stringify(patients));
}

// نمایش لیست بیماران
function renderPatientsList(filteredPatients = patients) {
  const list = document.getElementById('patientsList');
  if (!list) return;
  list.innerHTML = '';

  if (filteredPatients.length === 0) {
    list.innerHTML = '<div style="text-align:center; color:#95a5a6;">بیماری یافت نشد</div>';
    return;
  }

  filteredPatients.forEach(p => {
    const div = document.createElement('div');
    div.className = 'patient-item';
    div.innerHTML = `
      <img src="${p.photo || 'https://via.placeholder.com/45'}" alt="photo">
      <div>
        <strong>${escapeHtml(p.name)}</strong><br>
        <small>${p.phone || ''}</small>
      </div>
    `;
    div.onclick = () => showPatientDetail(p.id);
    list.appendChild(div);
  });
}

// نمایش مودال افزودن بیمار
function showAddPatientModal() {
  document.getElementById('addPatientModal').classList.remove('hidden');
}

// بستن مودال
function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

// تبدیل فایل به Base64
function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

// افزودن بیمار جدید
async function addPatient() {
  const name = document.getElementById('pName').value.trim();
  if (!name) return alert("نام بیمار الزامی است");

  const photoInput = document.getElementById('pPhoto');
  let photoBase64 = null;

  if (photoInput.files[0]) {
    photoBase64 = await fileToBase64(photoInput.files[0]);
  }

  const newPatient = {
    id: Date.now().toString(),
    name,
    phone: document.getElementById('pPhone').value,
    birth: document.getElementById('pBirth').value,
    photo: photoBase64,
    visits: [],
    attachments: [],
    nextAppointment: null
  };

  patients.unshift(newPatient);
  saveToLocal();
  renderPatientsList();
  closeModal('addPatientModal');
  
  // پاک کردن فرم
  document.getElementById('pName').value = '';
  document.getElementById('pPhone').value = '';
  document.getElementById('pBirth').value = '';
  document.getElementById('pPhoto').value = '';
  
  showPatientDetail(newPatient.id);
}

// نمایش جزئیات بیمار
function showPatientDetail(id) {
  currentPatientId = id;
  const patient = patients.find(p => p.id === id);
  if (!patient) return;

  const detail = document.getElementById('patientDetail');
  const welcome = document.getElementById('welcome');
  welcome.classList.add('hidden');
  detail.classList.remove('hidden');

  let html = `
    <div style="display:flex; align-items:center; gap:15px; margin-bottom:20px;">
      <img src="${patient.photo || 'https://via.placeholder.com/80'}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;">
      <div>
        <h2>${escapeHtml(patient.name)}</h2>
        <p>${patient.phone || 'شماره ثبت نشده'} ${patient.birth ? '— متولد ' + patient.birth : ''}</p>
      </div>
    </div>

    <div class="action-buttons">
      <button onclick="editPatient()" class="btn-edit"><i class="fas fa-edit"></i> ویرایش اطلاعات</button>
      <button onclick="deletePatient()" class="btn-delete"><i class="fas fa-trash"></i> حذف بیمار</button>
    </div>

    <button onclick="showVisitModal()"><i class="fas fa-calendar-plus"></i> ثبت مراجعه جدید</button>
    <button onclick="addAttachment()"><i class="fas fa-paperclip"></i> پیوست فایل</button>

    <h3>نوبت بعدی</h3>
    <p>${patient.nextAppointment ? new Date(patient.nextAppointment).toLocaleDateString('fa-IR') : 'تنظیم نشده'}
      <button onclick="setNextAppointment()"><i class="fas fa-clock"></i> تنظیم نوبت</button>
    </p>

    <h3>مراجعات</h3>
    <ul>
  `;

  if (patient.visits.length === 0) {
    html += `<li>هیچ مراجعه‌ای ثبت نشده است</li>`;
  } else {
    patient.visits.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(v => {
      html += `<li><strong>${new Date(v.date).toLocaleDateString('fa-IR')}</strong>: ${escapeHtml(v.desc) || 'بدون توضیحات'}</li>`;
    });
  }

  html += `</ul><h3>پیوست‌ها</h3><ul>`;

  if (patient.attachments.length === 0) {
    html += `<li>هیچ فایلی پیوست نشده است</li>`;
  } else {
    patient.attachments.forEach((att, i) => {
      html += `<li>${new Date(att.date).toLocaleDateString('fa-IR')} — ${escapeHtml(att.name)} 
        <a href="${att.data}" download class="attachment-link"><i class="fas fa-download"></i> دانلود</a></li>`;
    });
  }

  html += `</ul>`;
  detail.innerHTML = html;
}

// نمایش مودال مراجعه
function showVisitModal() {
  // تنظیم تاریخ امروز به عنوان پیش‌فرض
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('visitDate').value = today;
  document.getElementById('visitDesc').value = '';
  document.getElementById('visitModal').classList.remove('hidden');
}

// ذخیره مراجعه
function saveVisit() {
  const patient = patients.find(p => p.id === currentPatientId);
  if (!patient) return;

  const visitDate = document.getElementById('visitDate').value;
  const visitDesc = document.getElementById('visitDesc').value;

  if (!visitDate) {
    alert("لطفاً تاریخ مراجعه را وارد کنید");
    return;
  }

  patient.visits.push({
    date: visitDate,
    desc: visitDesc || 'بدون توضیحات'
  });

  saveToLocal();
  closeModal('visitModal');
  showPatientDetail(currentPatientId);
}

// افزودن پیوست
async function addAttachment() {
  const input = document.createElement('input');
  input.type = 'file';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      alert("حجم فایل نباید بیشتر از 5 مگابایت باشد");
      return;
    }
    
    const base64 = await fileToBase64(file);

    const patient = patients.find(p => p.id === currentPatientId);
    patient.attachments.push({
      name: file.name,
      data: base64,
      date: new Date().toISOString()
    });

    saveToLocal();
    showPatientDetail(currentPatientId);
  };
  input.click();
}

// تنظیم نوبت بعدی
function setNextAppointment() {
  const date = prompt("تاریخ نوبت بعدی (yyyy-mm-dd):", new Date().toISOString().split('T')[0]);
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const patient = patients.find(p => p.id === currentPatientId);
    patient.nextAppointment = date;
    saveToLocal();
    showPatientDetail(currentPatientId);
  } else if (date) {
    alert("فرمت تاریخ صحیح نیست. مثال: 2025-12-31");
  }
}

// جستجوی بیماران
function searchPatients() {
  const term = document.getElementById('searchInput').value.toLowerCase().trim();
  if (term === '') {
    renderPatientsList(patients);
  } else {
    const filtered = patients.filter(p => 
      p.name.toLowerCase().includes(term) || 
      (p.phone && p.phone.includes(term))
    );
    renderPatientsList(filtered);
  }
}

// ویرایش بیمار
function editPatient() {
  const patient = patients.find(p => p.id === currentPatientId);
  if (!patient) return;

  document.getElementById('pName').value = patient.name;
  document.getElementById('pPhone').value = patient.phone || '';
  document.getElementById('pBirth').value = patient.birth || '';
  document.getElementById('pPhoto').value = '';
  
  showAddPatientModal();
  
  // حذف موقت بیمار فعلی (بعد از افزودن بیمار جدید حذف می‌شود)
  const editHandler = async () => {
    const newName = document.getElementById('pName').value.trim();
    if (!newName) return;
    
    const photoInput = document.getElementById('pPhoto');
    let photoBase64 = patient.photo;
    
    if (photoInput.files[0]) {
      photoBase64 = await fileToBase64(photoInput.files[0]);
    }
    
    patient.name = newName;
    patient.phone = document.getElementById('pPhone').value;
    patient.birth = document.getElementById('pBirth').value;
    patient.photo = photoBase64;
    
    saveToLocal();
    renderPatientsList();
    closeModal('addPatientModal');
    showPatientDetail(currentPatientId);
    
    // حذف event listener
    const saveBtn = document.querySelector('#addPatientModal button:first-of-type');
    saveBtn.removeEventListener('click', editHandler);
    saveBtn.onclick = addPatient;
  };
  
  const saveBtn = document.querySelector('#addPatientModal button:first-of-type');
  saveBtn.onclick = editHandler;
}

// حذف بیمار
function deletePatient() {
  if (confirm('آیا از حذف این بیمار مطمئن هستید؟ این action قابل بازگشت نیست.')) {
    patients = patients.filter(p => p.id !== currentPatientId);
    saveToLocal();
    renderPatientsList();
    
    // بازگشت به صفحه خوش‌آمدگویی
    document.getElementById('welcome').classList.remove('hidden');
    document.getElementById('patientDetail').classList.add('hidden');
    currentPatientId = null;
  }
}

// جلوگیری از XSS
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

// مقداردهی اولیه
renderPatientsList();