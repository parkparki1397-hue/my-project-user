let patients = JSON.parse(localStorage.getItem('patients')) || [];
let currentPatientId = null;
let currentEditingVisitIndex = null;

const DEFAULT_PHOTO = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

function saveToLocal() {
  localStorage.setItem('patients', JSON.stringify(patients));
}

// تبدیل تاریخ شمسی به عدد برای مرتب‌سازی (مثال: 1405/02/12 → 14050212)
function persianDateToNumber(persianDate) {
  if (!persianDate) return 0;
  const numbers = persianDate.replace(/\//g, '');
  return parseInt(numbers, 10);
}

function toGregorian(persianDate) {
  if (!persianDate) return null;
  try {
    const parts = persianDate.split('/');
    if (parts.length !== 3) return null;
    const pd = new PersianDate([parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2])]);
    return pd.toDate().toISOString().split('T')[0];
  } catch (e) {
    return null;
  }
}

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
    div.innerHTML = `<img src="${p.photo || DEFAULT_PHOTO}" alt="photo"><div><strong>${escapeHtml(p.name)}</strong><br><small>${p.phone || ''}</small></div>`;
    div.onclick = () => showPatientDetail(p.id);
    list.appendChild(div);
  });
}

function showAddPatientModal() {
  document.getElementById('addPatientModal').classList.remove('hidden');
  setTimeout(() => {
    if ($('#pBirth').data('persianDatepicker')) {
      $('#pBirth').persianDatepicker('destroy');
    }
    $('#pBirth').persianDatepicker({
      format: 'YYYY/MM/DD',
      autoClose: true,
      initialValue: false
    });
  }, 100);
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

async function addPatient() {
  const name = document.getElementById('pName').value.trim();
  if (!name) return alert("نام بیمار الزامی است");
  const photoInput = document.getElementById('pPhoto');
  let photoBase64 = null;
  if (photoInput.files[0]) photoBase64 = await fileToBase64(photoInput.files[0]);
  const newPatient = {
    id: Date.now().toString(),
    name,
    nationalId: document.getElementById('pNationalId').value,
    phone: document.getElementById('pPhone').value,
    birth: document.getElementById('pBirth').value,
    job: document.getElementById('pJob').value,
    address: document.getElementById('pAddress').value,
    description: document.getElementById('pDescription').value,
    photo: photoBase64,
    visits: [],
    appointments: []
  };
  patients.unshift(newPatient);
  saveToLocal();
  renderPatientsList();
  closeModal('addPatientModal');
  document.getElementById('pName').value = '';
  document.getElementById('pNationalId').value = '';
  document.getElementById('pPhone').value = '';
  document.getElementById('pBirth').value = '';
  document.getElementById('pJob').value = '';
  document.getElementById('pAddress').value = '';
  document.getElementById('pDescription').value = '';
  document.getElementById('pPhoto').value = '';
  showPatientDetail(newPatient.id);
}

function showPatientDetail(id) {
  currentPatientId = id;
  const patient = patients.find(p => p.id === id);
  if (!patient) return;
  const detail = document.getElementById('patientDetail');
  const welcome = document.getElementById('welcome');
  welcome.classList.add('hidden');
  detail.classList.remove('hidden');

  // مرتب‌سازی مراجعات بر اساس عدد تاریخ شمسی (جدیدترین اول)
  let sortedVisits = [...patient.visits];
  sortedVisits.sort((a, b) => {
    const numA = persianDateToNumber(a.date);
    const numB = persianDateToNumber(b.date);
    return numB - numA;
  });

  // مرتب‌سازی نوبت‌ها بر اساس عدد تاریخ شمسی (جدیدترین اول)
  let sortedAppointments = [...(patient.appointments || [])];
  sortedAppointments.sort((a, b) => {
    const numA = persianDateToNumber(a.date);
    const numB = persianDateToNumber(b.date);
    return numB - numA;
  });

  let html = `
    <div style="display:flex; align-items:center; gap:15px; margin-bottom:20px;">
      <img src="${patient.photo || DEFAULT_PHOTO}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;">
      <div>
        <h2>${escapeHtml(patient.name)}</h2>
        <p>کد ملی: ${patient.nationalId || 'ثبت نشده'}</p>
        <p>${patient.phone || 'شماره ثبت نشده'} ${patient.birth ? '— متولد ' + patient.birth : ''}</p>
        <p>${patient.job ? 'شغل: ' + escapeHtml(patient.job) : ''} ${patient.address ? '— آدرس: ' + escapeHtml(patient.address) : ''}</p>
        <p>توضیحات: ${patient.description ? escapeHtml(patient.description) : 'ثبت نشده'}</p>
      </div>
    </div>
    <div class="action-buttons">
      <button onclick="editPatient()" class="btn-edit"><i class="fas fa-edit"></i> ویرایش اطلاعات</button>
      <button onclick="deletePatient()" class="btn-delete"><i class="fas fa-trash"></i> حذف بیمار</button>
    </div>
    <button onclick="showVisitModal()"><i class="fas fa-calendar-plus"></i> ثبت مراجعه جدید</button>

    <h3>📋 مراجعات (جدیدترین اول)</h3>
    <ul>`;

  if (sortedVisits.length === 0) {
    html += `<li>هیچ مراجعه‌ای ثبت نشده است</li>`;
  } else {
    sortedVisits.forEach((v) => {
      html += `<li><strong>${v.date}</strong> (${v.type || 'حضوری'})<br>${escapeHtml(v.desc) || 'بدون توضیحات'}<br>`;
      if (v.files && v.files.length > 0) {
        html += `<div class="attachments-list">پیوست‌ها: `;
        v.files.forEach((file) => {
          const isImage = file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
          if (isImage) {
            html += `<a href="${file.data}" target="_blank" class="attachment-link"><i class="fas fa-image"></i> نمایش ${escapeHtml(file.name)}</a> `;
          } else {
            html += `<a href="${file.data}" download="${file.name}" class="attachment-link"><i class="fas fa-download"></i> دانلود ${escapeHtml(file.name)}</a> `;
          }
        });
        html += `</div>`;
      }
      html += `</li>`;
    });
  }
  html += `</ul>

    <h3>نوبت‌های بعدی (جدیدترین اول)</h3>
    <div id="appointmentsSection"></div>
    <button onclick="showAppointmentsModal()"><i class="fas fa-calendar-alt"></i> مدیریت نوبت‌ها (حداکثر 5 نوبت)</button>
  </div>`;
  detail.innerHTML = html;

  const appointmentsDiv = document.getElementById('appointmentsSection');
  if (appointmentsDiv) {
    if (sortedAppointments.length > 0) {
      let appsHtml = `<ul>`;
      sortedAppointments.forEach((app) => {
        appsHtml += `<li>${app.date}</li>`;
      });
      appsHtml += `</ul>`;
      appointmentsDiv.innerHTML = appsHtml;
    } else {
      appointmentsDiv.innerHTML = '<p>هیچ نوبتی ثبت نشده است</p>';
    }
  }
}

function showVisitModal() {
  document.getElementById('visitDate').value = '';
  document.getElementById('visitType').value = 'حضوری';
  document.getElementById('visitDesc').value = '';
  document.getElementById('visitFiles').value = '';
  document.getElementById('visitModal').classList.remove('hidden');
  setTimeout(() => {
    if ($('#visitDate').data('persianDatepicker')) {
      $('#visitDate').persianDatepicker('destroy');
    }
    $('#visitDate').persianDatepicker({
      format: 'YYYY/MM/DD',
      autoClose: true,
      initialValue: false
    });
  }, 100);
}

async function saveVisit() {
  const patient = patients.find(p => p.id === currentPatientId);
  if (!patient) return;
  const visitDate = document.getElementById('visitDate').value;
  const visitType = document.getElementById('visitType').value;
  const visitDesc = document.getElementById('visitDesc').value;
  if (!visitDate) return alert("لطفاً تاریخ مراجعه را وارد کنید");
  
  const gregorianDate = toGregorian(visitDate);
  
  let filesArray = [];
  const fileInput = document.getElementById('visitFiles');
  if (fileInput.files.length > 0) {
    for (let i = 0; i < fileInput.files.length; i++) {
      const file = fileInput.files[i];
      if (file.size > 5 * 1024 * 1024) {
        alert(`حجم فایل ${file.name} بیشتر از 5 مگابایت است`);
        return;
      }
      const base64 = await fileToBase64(file);
      filesArray.push({
        name: file.name,
        data: base64
      });
    }
  }
  
  patient.visits.push({
    date: visitDate,
    gregorianDate: gregorianDate,
    type: visitType,
    desc: visitDesc || 'بدون توضیحات',
    files: filesArray
  });
  saveToLocal();
  closeModal('visitModal');
  showPatientDetail(currentPatientId);
}

function editVisit(index) {
  const patient = patients.find(p => p.id === currentPatientId);
  if (!patient) return;
  currentEditingVisitIndex = index;
  const visit = patient.visits[index];
  document.getElementById('editVisitDate').value = visit.date;
  document.getElementById('editVisitType').value = visit.type || 'حضوری';
  document.getElementById('editVisitDesc').value = visit.desc || '';
  document.getElementById('editVisitFiles').value = '';
  document.getElementById('editVisitModal').classList.remove('hidden');
  setTimeout(() => {
    if ($('#editVisitDate').data('persianDatepicker')) {
      $('#editVisitDate').persianDatepicker('destroy');
    }
    $('#editVisitDate').persianDatepicker({
      format: 'YYYY/MM/DD',
      autoClose: true,
      initialValue: false
    });
  }, 100);
}

async function updateVisit() {
  const patient = patients.find(p => p.id === currentPatientId);
  if (!patient || currentEditingVisitIndex === null) return;
  const visit = patient.visits[currentEditingVisitIndex];
  visit.date = document.getElementById('editVisitDate').value;
  visit.gregorianDate = toGregorian(visit.date);
  visit.type = document.getElementById('editVisitType').value;
  visit.desc = document.getElementById('editVisitDesc').value;
  
  const fileInput = document.getElementById('editVisitFiles');
  if (fileInput.files.length > 0) {
    if (!visit.files) visit.files = [];
    for (let i = 0; i < fileInput.files.length; i++) {
      const file = fileInput.files[i];
      if (file.size > 5 * 1024 * 1024) {
        alert(`حجم فایل ${file.name} بیشتر از 5 مگابایت است`);
        return;
      }
      const base64 = await fileToBase64(file);
      visit.files.push({
        name: file.name,
        data: base64
      });
    }
  }
  saveToLocal();
  closeModal('editVisitModal');
  showPatientDetail(currentPatientId);
  currentEditingVisitIndex = null;
}

function showAppointmentsModal() {
  const patient = patients.find(p => p.id === currentPatientId);
  if (!patient) return;
  const modal = document.getElementById('appointmentsModal');
  const listDiv = document.getElementById('appointmentsList');
  
  let sortedApps = [...(patient.appointments || [])];
  sortedApps.sort((a, b) => {
    const numA = persianDateToNumber(a.date);
    const numB = persianDateToNumber(b.date);
    return numB - numA;
  });
  
  if (sortedApps.length > 0) {
    let html = `<ul>`;
    sortedApps.forEach((app, idx) => {
      html += `<li>${app.date} <button onclick="removeAppointmentByDate('${app.date}')" class="btn-small">حذف</button></li>`;
    });
    html += `</ul>`;
    listDiv.innerHTML = html;
  } else {
    listDiv.innerHTML = '<p>هیچ نوبتی ثبت نشده است</p>';
  }
  modal.classList.remove('hidden');
  setTimeout(() => {
    if ($('#newAppointmentDate').data('persianDatepicker')) {
      $('#newAppointmentDate').persianDatepicker('destroy');
    }
    $('#newAppointmentDate').persianDatepicker({
      format: 'YYYY/MM/DD',
      autoClose: true,
      initialValue: false
    });
  }, 100);
}

function addAppointment() {
  const patient = patients.find(p => p.id === currentPatientId);
  if (!patient) return;
  const newDate = document.getElementById('newAppointmentDate').value;
  if (!newDate) return alert("لطفاً تاریخ نوبت را وارد کنید");
  if (!patient.appointments) patient.appointments = [];
  if (patient.appointments.length >= 5) {
    alert("حداکثر 5 نوبت می‌توانید ثبت کنید");
    return;
  }
  
  // بررسی عدم تکراری بودن نوبت
  const exists = patient.appointments.some(a => a.date === newDate);
  if (exists) {
    alert("این تاریخ قبلاً به عنوان نوبت ثبت شده است");
    return;
  }
  
  patient.appointments.push({
    date: newDate,
    gregorianDate: toGregorian(newDate)
  });
  saveToLocal();
  document.getElementById('newAppointmentDate').value = '';
  showAppointmentsModal();
  showPatientDetail(currentPatientId);
}

function removeAppointmentByDate(date) {
  const patient = patients.find(p => p.id === currentPatientId);
  if (!patient) return;
  patient.appointments = patient.appointments.filter(a => a.date !== date);
  saveToLocal();
  showAppointmentsModal();
  showPatientDetail(currentPatientId);
}

function searchPatients() {
  const term = document.getElementById('searchInput').value.toLowerCase().trim();
  if (term === '') renderPatientsList(patients);
  else {
    const filtered = patients.filter(p => 
      p.name.toLowerCase().includes(term) || 
      (p.phone && p.phone.includes(term)) ||
      (p.nationalId && p.nationalId.includes(term))
    );
    renderPatientsList(filtered);
  }
}

function editPatient() {
  const patient = patients.find(p => p.id === currentPatientId);
  if (!patient) return;
  document.getElementById('pName').value = patient.name;
  document.getElementById('pNationalId').value = patient.nationalId || '';
  document.getElementById('pPhone').value = patient.phone || '';
  document.getElementById('pBirth').value = patient.birth || '';
  document.getElementById('pJob').value = patient.job || '';
  document.getElementById('pAddress').value = patient.address || '';
  document.getElementById('pDescription').value = patient.description || '';
  document.getElementById('pPhoto').value = '';
  showAddPatientModal();
  const saveBtn = document.querySelector('#addPatientModal button:first-of-type');
  const originalClick = saveBtn.onclick;
  saveBtn.onclick = async () => {
    const newName = document.getElementById('pName').value.trim();
    if (!newName) return;
    const photoInput = document.getElementById('pPhoto');
    let photoBase64 = patient.photo;
    if (photoInput.files[0]) photoBase64 = await fileToBase64(photoInput.files[0]);
    patient.name = newName;
    patient.nationalId = document.getElementById('pNationalId').value;
    patient.phone = document.getElementById('pPhone').value;
    patient.birth = document.getElementById('pBirth').value;
    patient.job = document.getElementById('pJob').value;
    patient.address = document.getElementById('pAddress').value;
    patient.description = document.getElementById('pDescription').value;
    patient.photo = photoBase64;
    saveToLocal();
    renderPatientsList();
    closeModal('addPatientModal');
    showPatientDetail(currentPatientId);
    saveBtn.onclick = originalClick;
  };
}

function deletePatient() {
  if (confirm('حذف بیمار؟ غیرقابل بازگشت')) {
    patients = patients.filter(p => p.id !== currentPatientId);
    saveToLocal();
    renderPatientsList();
    document.getElementById('welcome').classList.remove('hidden');
    document.getElementById('patientDetail').classList.add('hidden');
    currentPatientId = null;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}
// ========== توابع پشتیبان محلی (ساده و بدون خطا) ==========

function backupLocal() {
  const dataStr = JSON.stringify(patients, null, 2);
  const blob = new Blob([dataStr], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `پشتیبان_پزشکی_${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  alert("✅ فایل پشتیبان با موفقیت ذخیره شد!");
}

function restoreLocal() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.onchange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const restoredPatients = JSON.parse(e.target.result);
        if (confirm(`آیا از بازیابی ${restoredPatients.length} بیمار اطمینان دارید؟ داده‌های فعلی جایگزین می‌شود.`)) {
          patients = restoredPatients;
          saveToLocal();
          renderPatientsList();
          if (currentPatientId && patients.find(p => p.id === currentPatientId)) {
            showPatientDetail(currentPatientId);
          } else {
            document.getElementById('welcome').classList.remove('hidden');
            document.getElementById('patientDetail').classList.add('hidden');
            currentPatientId = null;
          }
          alert("✅ بازیابی با موفقیت انجام شد!");
        }
      } catch (error) {
        alert("❌ فایل پشتیبان معتبر نیست: " + error.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}


renderPatientsList();
