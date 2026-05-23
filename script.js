document.addEventListener('DOMContentLoaded', () => {

  /* ==========================================================================
     ELEMENT SELECTORS
     ========================================================================== */
  const htmlElement = document.documentElement;
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const credentialForm = document.getElementById('credential-form');
  const submitBtn = document.getElementById('submit-btn');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnSpinner = submitBtn.querySelector('.btn-spinner');

  // Aplikator inputs & panes
  const aplikatorCheckboxes = document.querySelectorAll('input[name="aplikator"]');
  const credentialPanes = {
    gofood: document.getElementById('pane-gofood'),
    grab: document.getElementById('pane-grab'),
    shopee: document.getElementById('pane-shopee')
  };

  // Success Modal Elements
  const successModal = document.getElementById('success-modal');
  const jsonOutput = document.getElementById('json-output');
  const copyJsonBtn = document.getElementById('copy-json-btn');
  const downloadJsonBtn = document.getElementById('download-json-btn');
  const closeModalBtn = document.getElementById('close-modal-btn');

  // Inputs for static fields
  const ownerNameInput = document.getElementById('owner-name');
  const outletNameInput = document.getElementById('outlet-name');

  let submittedData = null; // Storing submitted payload for export

  // URL Google Apps Script Web App (Tempel URL Anda di sini setelah men-deploy Apps Script)
  const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbx1GeEBNpiwNymIghNksgLu_XyVROUCqPxwC2q5HxGQEGDBrNcpZdhyZtyQZSKBc9xDTw/exec";
  // Ubah ke true untuk mengirim ke Sheets, atau false untuk simulasi mock lokal saja
  const ENABLE_SHEET_SUBMISSION = true;

  /* ==========================================================================
     THEME STORAGE & TOGGLE SYSTEM
     ========================================================================== */
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    htmlElement.setAttribute('data-theme', savedTheme);
  } else {
    // Detect system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    htmlElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  }

  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = htmlElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    htmlElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    showToast(
      'Tema Diganti',
      `Menggunakan mode ${newTheme === 'dark' ? 'gelap' : 'terang'}.`,
      'info'
    );
  });

  /* ==========================================================================
     DYNAMIC APILIKATOR CONTROLLER
     ========================================================================== */
  aplikatorCheckboxes.forEach(checkbox => {
    // Inisialisasi awal berdasarkan state checkbox di HTML
    toggleAplikatorPane(checkbox.value, checkbox.checked, true);

    checkbox.addEventListener('change', (e) => {
      toggleAplikatorPane(e.target.value, e.target.checked, false);
    });
  });

  function toggleAplikatorPane(aplikator, isChecked, isInit = false) {
    const pane = credentialPanes[aplikator];
    if (!pane) return;

    const inputs = pane.querySelectorAll('input');

    if (isChecked) {
      pane.classList.add('active');
      // Aktifkan required attribute untuk field input dari pane ini
      inputs.forEach(input => {
        input.setAttribute('required', 'true');
      });
      if (!isInit) {
        showToast(
          'Aplikator Ditambahkan',
          `Input kredensial ${capitalizeWord(aplikator)} ditampilkan.`,
          'info'
        );
      }
    } else {
      pane.classList.remove('active');
      // Matikan required attribute dan bersihkan styling validasi
      inputs.forEach(input => {
        input.removeAttribute('required');
        const group = input.closest('.input-group');
        if (group) {
          group.classList.remove('is-valid', 'is-invalid');
        }
      });
      if (!isInit) {
        showToast(
          'Aplikator Dihapus',
          `Input kredensial ${capitalizeWord(aplikator)} disembunyikan.`,
          'info'
        );
      }
    }
  }

  // Capitalize helpers
  function capitalizeWord(string) {
    if (string === 'gofood') return 'GoFood';
    if (string === 'grab') return 'GrabFood';
    if (string === 'shopee') return 'ShopeeFood';
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  /* ==========================================================================
     PASSWORD VISIBILITY TOGGLER
     ========================================================================== */
  // Password visibility toggler (using event delegation)
  document.addEventListener('click', (e) => {
    const toggleBtn = e.target.closest('.password-toggle');
    if (!toggleBtn) return;

    const passwordInput = toggleBtn.closest('.password-group').querySelector('input');
    if (!passwordInput) return;

    const isPassword = passwordInput.getAttribute('type') === 'password';
    passwordInput.setAttribute('type', isPassword ? 'text' : 'password');

    const eyeIcon = toggleBtn.querySelector('.eye-icon');
    const eyeOffIcon = toggleBtn.querySelector('.eye-off-icon');

    if (isPassword) {
      eyeIcon.classList.add('hidden');
      eyeOffIcon.classList.remove('hidden');
      toggleBtn.setAttribute('aria-label', 'Sembunyikan password');
    } else {
      eyeIcon.classList.remove('hidden');
      eyeOffIcon.classList.add('hidden');
      toggleBtn.setAttribute('aria-label', 'Tampilkan password');
    }
  });

  /* ==========================================================================
     DYNAMIC CREDENTIAL ROWS CONTROLLER
     ========================================================================== */
  const addRowButtons = document.querySelectorAll('.add-row-btn');
  addRowButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      addCredentialRow(target);
    });
  });

  // Handle Remove Row buttons (using event delegation)
  document.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.remove-row-btn');
    if (!removeBtn) return;

    const rowWrapper = removeBtn.closest('.credential-row-wrapper');
    if (!rowWrapper) return;

    // Add exit animation class
    rowWrapper.classList.remove('animate-row-enter');
    rowWrapper.classList.add('animate-row-exit');

    // Remove from DOM after animation completes
    rowWrapper.addEventListener('animationend', () => {
      rowWrapper.remove();
      showToast('Akun Dihapus', 'Field kredensial tambahan telah dihapus.', 'info');
    });
  });

  function addCredentialRow(target) {
    const container = document.getElementById(`${target}-rows-container`);
    if (!container) return;

    const rowWrapper = document.createElement('div');
    rowWrapper.className = 'credential-row-wrapper animate-row-enter';

    const uniqueIdSuffix = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    let contentHtml = '';
    if (target === 'gofood') {
      const emailId = `gofood-email-${uniqueIdSuffix}`;
      contentHtml = `
        <div class="credential-row-content">
          <div class="input-group">
            <input type="email" id="${emailId}" class="gofood-email-input" name="gofoodEmail" required placeholder=" ">
            <label for="${emailId}">Email Terdaftar GoFood</label>
            <span class="focus-bar"></span>
            <span class="error-msg">Email tidak valid</span>
            <div class="validation-icon">
              <svg class="valid" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <svg class="invalid" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </div>
          </div>
        </div>
        <button type="button" class="remove-row-btn" aria-label="Hapus akun">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </button>
      `;
    } else if (target === 'grab') {
      const usernameId = `grab-username-${uniqueIdSuffix}`;
      const passwordId = `grab-password-${uniqueIdSuffix}`;
      contentHtml = `
        <div class="credential-row-content">
          <div class="form-grid">
            <div class="input-group">
              <input type="text" id="${usernameId}" class="grab-username-input" name="grabUsername" required placeholder=" ">
              <label for="${usernameId}">Username</label>
              <span class="focus-bar"></span>
              <span class="error-msg">Username wajib diisi</span>
              <div class="validation-icon">
                <svg class="valid" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <svg class="invalid" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </div>
            </div>
            <div class="input-group password-group">
              <input type="password" id="${passwordId}" class="grab-password-input" name="grabPassword" required placeholder=" ">
              <label for="${passwordId}">Password</label>
              <span class="focus-bar"></span>
              <span class="error-msg">Password minimal 6 karakter</span>
              <button type="button" class="password-toggle" aria-label="Tampilkan password">
                <svg class="eye-icon" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <svg class="eye-off-icon hidden" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              </button>
              <div class="validation-icon">
                <svg class="valid" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <svg class="invalid" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </div>
            </div>
          </div>
        </div>
        <button type="button" class="remove-row-btn" aria-label="Hapus akun">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </button>
      `;
    } else if (target === 'shopee') {
      const portalId = `shopee-portal-${uniqueIdSuffix}`;
      contentHtml = `
        <div class="credential-row-content">
          <div class="input-group">
            <input type="text" id="${portalId}" class="shopee-portal-input" name="shopeePortal" required placeholder=" ">
            <label for="${portalId}">Nama Portal Partner Shopee</label>
            <span class="focus-bar"></span>
            <span class="error-msg">Nama portal wajib diisi</span>
            <div class="validation-icon">
              <svg class="valid" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <svg class="invalid" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </div>
          </div>
        </div>
        <button type="button" class="remove-row-btn" aria-label="Hapus akun">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </button>
      `;
    }

    rowWrapper.innerHTML = contentHtml;
    container.appendChild(rowWrapper);
    
    // Auto-required if pane is active
    const activeInputs = rowWrapper.querySelectorAll('input');
    const pane = container.closest('.credential-pane');
    if (pane && pane.classList.contains('active')) {
      activeInputs.forEach(inp => inp.setAttribute('required', 'true'));
    }

    // Focus first input
    const firstInput = rowWrapper.querySelector('input');
    if (firstInput) {
      firstInput.focus();
    }

    showToast(
      'Akun Ditambahkan',
      `Field tambahan untuk ${capitalizeWord(target)} berhasil dibuat.`,
      'info'
    );
  }

  /* ==========================================================================
     FORM VALIDATION ENGINE
     ========================================================================== */

  // Real-time listener for inputs using event delegation
  credentialForm.addEventListener('input', (e) => {
    if (e.target.tagName === 'INPUT') {
      validateField(e.target);
    }
  });

  credentialForm.addEventListener('focusout', (e) => {
    if (e.target.tagName === 'INPUT') {
      validateField(e.target);
    }
  });

  function validateField(input) {
    // Check if the input is inside an active pane or is a static field
    const pane = input.closest('.credential-pane');
    if (pane && !pane.classList.contains('active')) {
      return true; // Ignore validation for inactive panes
    }

    const group = input.closest('.input-group');
    if (!group) return true;

    const value = input.value.trim();
    let isValid = true;
    let errorMessage = '';

    // Required check
    if (input.hasAttribute('required') && value === '') {
      isValid = false;
      errorMessage = getRequiredErrorMessage(input);
    } else if (value !== '') {
      // Format validations
      if (input.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          isValid = false;
          errorMessage = 'Format email tidak valid';
        }
      } else if (input.classList.contains('grab-password-input')) {
        if (value.length < 6) {
          isValid = false;
          errorMessage = 'Sandi minimal 6 karakter';
        }
      }
    }

    // Toggle validation visual states
    if (isValid) {
      group.classList.remove('is-invalid');
      group.classList.add('is-valid');
    } else {
      group.classList.remove('is-valid');
      group.classList.add('is-invalid');
      const errorMsgSpan = group.querySelector('.error-msg');
      if (errorMsgSpan) {
        errorMsgSpan.textContent = errorMessage;
      }
    }

    return isValid;
  }

  function getRequiredErrorMessage(input) {
    const id = input.id;
    if (id === 'owner-name') return 'Nama pemilik wajib diisi';
    if (id === 'outlet-name') return 'Nama outlet wajib diisi';
    
    if (input.classList.contains('gofood-email-input')) return 'Email mitra GoFood wajib diisi';
    if (input.classList.contains('grab-username-input')) return 'Username Grab wajib diisi';
    if (input.classList.contains('grab-password-input')) return 'Password Grab wajib diisi';
    if (input.classList.contains('shopee-portal-input')) return 'Nama portal partner Shopee wajib diisi';
    
    return 'Field ini wajib diisi';
  }

  /* ==========================================================================
     SUBMIT HANDLING & PAYLOAD SIMULATION
     ========================================================================== */
  credentialForm.addEventListener('submit', (e) => {
    e.preventDefault();

    // Dapatkan semua aplikator yang dipilih
    const selectedAplikators = Array.from(aplikatorCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
    if (selectedAplikators.length === 0) {
      showToast('Form Tidak Lengkap', 'Pilih minimal satu aplikator (GoFood / GrabFood / ShopeeFood).', 'error');
      return;
    }

    // Trigger validation for all active inputs
    let formIsValid = true;

    // Static fields
    const staticValidations = [validateField(ownerNameInput), validateField(outletNameInput)];
    if (staticValidations.includes(false)) {
      formIsValid = false;
    }

    // Active credential fields
    selectedAplikators.forEach(aplikator => {
      let selector = '';
      if (aplikator === 'gofood') selector = '.gofood-email-input';
      else if (aplikator === 'grab') selector = '.grab-username-input, .grab-password-input';
      else if (aplikator === 'shopee') selector = '.shopee-portal-input';

      const inputs = document.querySelectorAll(`#pane-${aplikator} ${selector}`);
      inputs.forEach(input => {
        if (!validateField(input)) {
          formIsValid = false;
        }
      });
    });

    if (!formIsValid) {
      // Find first invalid input for autofocus & shake highlight
      const invalidGroup = credentialForm.querySelector('.input-group.is-invalid');
      if (invalidGroup) {
        const input = invalidGroup.querySelector('input');
        if (input) {
          input.focus();
        }
      }
      showToast('Form Tidak Lengkap', 'Silakan lengkapi atau perbaiki kolom yang salah.', 'error');
      return;
    }

    // Process Valid Submission
    executeSubmission(selectedAplikators);
  });

  function executeSubmission(selectedAplikators) {
    // Trigger loading state
    submitBtn.disabled = true;
    btnText.style.opacity = '0';
    btnSpinner.classList.remove('hidden');

    let credentialsPayload = {};
    let sheetsPayloads = [];

    selectedAplikators.forEach(aplikator => {
      if (aplikator === 'gofood') {
        const emailInputs = document.querySelectorAll('#pane-gofood .gofood-email-input');
        credentialsPayload.gofood = [];
        emailInputs.forEach(input => {
          const emailVal = input.value.trim();
          credentialsPayload.gofood.push({ email: emailVal });
          
          sheetsPayloads.push({
            owner: ownerNameInput.value.trim(),
            outlet: outletNameInput.value.trim(),
            aplikator: 'GoFood',
            email: emailVal
          });
        });
      } else if (aplikator === 'grab') {
        const rows = document.querySelectorAll('#pane-grab .credential-row-wrapper');
        credentialsPayload.grab = [];
        rows.forEach(row => {
          const userVal = row.querySelector('.grab-username-input').value.trim();
          const passVal = row.querySelector('.grab-password-input').value.trim();
          credentialsPayload.grab.push({ username: userVal, password: passVal });
          
          sheetsPayloads.push({
            owner: ownerNameInput.value.trim(),
            outlet: outletNameInput.value.trim(),
            aplikator: 'GrabFood',
            username: userVal,
            password: passVal
          });
        });
      } else if (aplikator === 'shopee') {
        const portalInputs = document.querySelectorAll('#pane-shopee .shopee-portal-input');
        credentialsPayload.shopee = [];
        portalInputs.forEach(input => {
          const portalVal = input.value.trim();
          credentialsPayload.shopee.push({ namaPortal: portalVal });
          
          sheetsPayloads.push({
            owner: ownerNameInput.value.trim(),
            outlet: outletNameInput.value.trim(),
            aplikator: 'ShopeeFood',
            merchantName: portalVal
          });
        });
      }
    });

    // Compile entire payload for UI display (JSON Output)
    submittedData = {
      namaOwner: ownerNameInput.value.trim(),
      namaOutlet: outletNameInput.value.trim(),
      aplikator: selectedAplikators.map(val => capitalizeWord(val)),
      kredensial: credentialsPayload,
      metadata: {
        waktuIntegrasi: new Date().toISOString(),
        versiSkema: "1.0.0",
        statusEnkripsi: "AES-256 Terenkripsi"
      }
    };

    // Jika URL Apps Script aktif dan fitur diaktifkan, kirim data ke Google Sheets
    if (ENABLE_SHEET_SUBMISSION && WEB_APP_URL && WEB_APP_URL !== "YOUR_DEPLOYED_WEB_APP_URL") {
      const fetchPromises = sheetsPayloads.map(payload => {
        return fetch(WEB_APP_URL, {
          method: "POST",
          mode: "cors",
          headers: {
            "Content-Type": "text/plain;charset=utf-8"
          },
          body: JSON.stringify(payload)
        })
        .then(response => response.json());
      });

      Promise.all(fetchPromises)
        .then(results => {
          const failed = results.filter(resData => resData.status !== "success");
          if (failed.length === 0) {
            showToast('Sinkronisasi Sukses', 'Semua kredensial berhasil disimpan di Google Sheets!', 'success');
            finalizeSubmission('success');
          } else {
            const errMsgs = failed.map(f => f.message).join(', ');
            showToast('Sinkronisasi Gagal', 'Beberapa data gagal disimpan ke Google Sheets.', 'error');
            finalizeSubmission('error', errMsgs);
          }
        })
        .catch(error => {
          console.error("Error submitting to Sheets:", error);
          showToast('Koneksi Gagal', 'Gagal terhubung dengan server, data lokal tetap diamankan.', 'error');
          finalizeSubmission('error', 'Koneksi terputus atau URL tidak valid');
        });
    } else {
      // Mock simulation delay (1.5 detik)
      setTimeout(() => {
        showToast('Simulasi Sukses', 'Kredensial berhasil dipaketkan menjadi JSON!', 'success');
        finalizeSubmission('success');
      }, 1500);
    }
  }

  function finalizeSubmission(status = 'success', errorMsg = '') {
    // Revert loading states
    submitBtn.disabled = false;
    btnText.style.opacity = '1';
    btnSpinner.classList.add('hidden');

    const modalTitle = document.getElementById('modal-title');
    const modalDesc = document.querySelector('.modal-desc');
    const checkmarkSvg = document.querySelector('.checkmark-svg');
    const checkmarkCircle = document.querySelector('.checkmark-circle');

    if (status === 'error') {
      modalTitle.textContent = "Butuh Tindakan Manual!";
      modalTitle.style.color = "HSL(var(--color-invalid))";
      modalDesc.innerHTML = `Sinkronisasi otomatis ke sistem gagal. <b>Data Anda telah dipaketkan.</b> Silakan unduh atau salin JSON di bawah ini dan serahkan ke tim admin. ${errorMsg ? `<br><small style="color:var(--text-muted)">Detail: ${errorMsg}</small>` : ''}`;

      // Ubah warna ikon menjadi oranye/merah sebagai peringatan
      if (checkmarkSvg) checkmarkSvg.style.stroke = "#f59e0b"; // Warning Orange
      if (checkmarkCircle) checkmarkCircle.style.stroke = "#f59e0b";
    } else {
      modalTitle.textContent = "Kredensial Berhasil Didaftarkan!";
      modalTitle.style.color = "var(--text-primary)";
      modalDesc.innerHTML = "Data Anda telah divalidasi dan dikirim dengan aman. Berikut adalah payload data integrasi yang dihasilkan:";

      // Kembalikan ke warna hijau sukses
      if (checkmarkSvg) checkmarkSvg.style.stroke = "HSL(var(--color-valid))";
      if (checkmarkCircle) checkmarkCircle.style.stroke = "HSL(var(--color-valid))";
    }

    // Inject formatted JSON ke panel modal
    jsonOutput.textContent = JSON.stringify(submittedData, null, 2);

    // Buka Success Modal
    successModal.classList.add('open');
  }

  /* ==========================================================================
     SUCCESS STATE & EXPORTS (MODAL ACTIONS)
     ========================================================================== */

  // Close Modal / Reset Form
  closeModalBtn.addEventListener('click', () => {
    closeSuccessModal();
  });

  // Also close modal when clicking overlay background
  successModal.addEventListener('click', (e) => {
    if (e.target === successModal) {
      closeSuccessModal();
    }
  });

  function closeSuccessModal() {
    successModal.classList.remove('open');
    // Form tidak di-reset agar semua inputan user tidak hilang setelah submit
  }

  // Copy JSON Payload to Clipboard
  copyJsonBtn.addEventListener('click', () => {
    const textToCopy = jsonOutput.textContent;
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        // Toggle text/icons
        const copyDefault = copyJsonBtn.querySelector('.copy-text-default');
        const copySuccess = copyJsonBtn.querySelector('.copy-text-success');

        copyDefault.classList.add('hidden');
        copySuccess.classList.remove('hidden');

        showToast('Tersalin!', 'JSON Payload disalin ke papan klip.', 'success');

        setTimeout(() => {
          copyDefault.classList.remove('hidden');
          copySuccess.classList.add('hidden');
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
        showToast('Gagal Menyalin', 'Gagal mengakses papan klip perangkat.', 'error');
      });
  });

  // Download JSON Payload as file
  downloadJsonBtn.addEventListener('click', () => {
    if (!submittedData) return;

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(submittedData, null, 2));
    const downloadAnchor = document.createElement('a');

    // Formulate a beautiful safe name
    const outletSlug = submittedData.namaOutlet.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const activeApps = Array.from(aplikatorCheckboxes).filter(cb => cb.checked).map(cb => cb.value).join('_');
    const filename = `kredensial_${outletSlug}_${activeApps || 'multi'}.json`;

    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showToast('Unduhan Berhasil', `${filename} disimpan ke perangkat Anda.`, 'success');
  });

  /* ==========================================================================
     TOAST NOTIFICATION ENGINE
     ========================================================================== */
  const toastContainer = document.getElementById('toast-container');

  function showToast(title, message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    // SVG icons based on toast types
    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    } else { // info
      iconSvg = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `
      <div class="toast-icon">${iconSvg}</div>
      <div class="toast-content">
        <h4>${title}</h4>
        <p>${message}</p>
      </div>
    `;

    toastContainer.appendChild(toast);

    // Auto-remove toast after 4 seconds
    setTimeout(() => {
      toast.style.transform = 'translateY(20px)';
      toast.style.opacity = '0';

      // Remove element from DOM after transition finishes
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 4000);
  }

});
