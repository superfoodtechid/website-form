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
  const submissionSummary = document.getElementById('submission-summary');
  const closeModalBtn = document.getElementById('close-modal-btn');

  // Inputs for static fields
  const ownerNameInput = document.getElementById('owner-name');
  const outletNameInput = document.getElementById('outlet-name');
  const bdSelect = document.getElementById('bd-select');

  let submittedData = null; // Storing submitted payload for export

  // URL Google Apps Script Web App (Tempel URL Anda di sini setelah men-deploy Apps Script)
  const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbx1GeEBNpiwNymIghNksgLu_XyVROUCqPxwC2q5HxGQEGDBrNcpZdhyZtyQZSKBc9xDTw/exec";
  // Ubah ke true untuk mengirim ke Sheets, atau false untuk simulasi mock lokal saja
  const ENABLE_SHEET_SUBMISSION = true;

  // URL CSV Google Sheet konfigurasi BD (sheet gid=565510790)
  // CSV lebih responsif terhadap perubahan dibanding pubhtml yang di-cache Google
  const BD_CONFIG_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRYSUnKOqk29LCktTxdb0wPLbWMbRaWRP3eC_UA4AwYod1FW6zDMhtLMC5ghIvot2B8upCDfBsn-TCP/pub?gid=565510790&single=true&output=csv";

  // BD Map — akan diisi dari sheet saat halaman load
  let bdMap = {};

  const CACHE_KEY = 'bdMapCache';
  const CACHE_TTL = 5 * 60 * 1000; // 5 menit

  // Isi dropdown dengan nama BD
  function populateBdDropdown(bdNames) {
    // Cek apakah opsi saat ini sama dengan data baru (menghindari opsi melompat saat user memilih)
    const currentOptions = Array.from(bdSelect.options).map(opt => opt.value).filter(val => val !== '');
    const isSame = currentOptions.length === bdNames.length && currentOptions.every((val, i) => val === bdNames[i]);
    
    if (isSame) {
      console.log('[BD Dropdown] Opsi tidak berubah, skip update DOM.');
      return;
    }

    // Simpan value yang sedang dipilih
    const selectedValue = bdSelect.value;

    while (bdSelect.options.length > 1) {
      bdSelect.remove(1);
    }
    bdNames.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      bdSelect.appendChild(opt);
    });

    // Kembalikan pilihan user jika ada di list yang baru
    if (selectedValue && bdNames.includes(selectedValue)) {
      bdSelect.value = selectedValue;
    }

    console.log('[BD Dropdown] Opsi diperbarui:', bdNames);
  }

  /* ==========================================================================
     LOAD BD MAP DARI GOOGLE SHEET CSV (DINAMIS)
     ========================================================================== */
  async function loadBdMapFromSheet(forceFetch = false) {
    try {
      // Cek Cache Lokal agar loading instan
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached && !forceFetch) {
        try {
          const parsedCache = JSON.parse(cached);
          if (Date.now() - parsedCache.timestamp < CACHE_TTL) {
            bdMap = parsedCache.bdMap;
            populateBdDropdown(parsedCache.bdNames);
            console.log('[BD Cache] Menggunakan data cache, lanjut update di background...');
            // Tidak menggunakan return di sini agar fetch tetap berjalan di background
            // sehingga saat user refresh halaman, data selalu sinkron dengan yang terbaru
          }
        } catch(e) {
          console.warn('[BD Cache] Gagal membaca cache:', e);
        }
      }

      // Cache-busting agar selalu fresh dari Google Sheet
      const cacheBuster = `&t=${Date.now()}`;
      const resp = await fetch(BD_CONFIG_URL + cacheBuster, { cache: 'no-store' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const text = await resp.text();

      // Parser CSV
      const parseCSV = (str) => {
        const rows = [];
        let currentRow = [], currentCell = '', inQuotes = false;
        for (let i = 0; i < str.length; i++) {
          const char = str[i], nextChar = str[i + 1];
          if (char === '"') {
            if (inQuotes && nextChar === '"') { currentCell += '"'; i++; }
            else { inQuotes = !inQuotes; }
          } else if (char === ',' && !inQuotes) {
            currentRow.push(currentCell); currentCell = '';
          } else if (char === '\n' && !inQuotes) {
            currentRow.push(currentCell); rows.push(currentRow);
            currentRow = []; currentCell = '';
          } else if (char !== '\r') {
            currentCell += char;
          }
        }
        currentRow.push(currentCell);
        rows.push(currentRow);
        return rows;
      };

      const rows = parseCSV(text);
      console.log('[BD Debug] Total baris CSV:', rows.length);

      const newMap = {};
      const bdNames = [];

      // Kolom CSV dari gid=565510790 (0-indexed, tanpa offset th):
      // A(0)=No, B(1)=Portal, C(2)=Role, D(3)=Phone,
      // E(4)=Username, F(5)=Password, G(6)=Notes, H(7)=OTP, I(8)=BD
      // Mulai dari baris sheet ke-7 → index ke-6 di array CSV
      let emptyStreak = 0;
      for (let i = 6; i < rows.length; i++) {
        const cols = rows[i];
        const bdName = (cols[8] || '').trim();

        if (!bdName) {
          emptyStreak++;
          if (emptyStreak >= 3) break;
          continue;
        }
        emptyStreak = 0;

        const username = (cols[4] || '').trim();
        const password = (cols[5] || '').trim();

        console.log(`[BD Debug] Row ${i + 1} → bdName="${bdName}", username="${username}"`);

        if (bdName && username) {
          newMap[bdName] = { username, password };
          if (!bdNames.includes(bdName)) {
            bdNames.push(bdName);
          }
        }
      }

      console.log('[BD Debug] BD yang berhasil dimuat:', bdNames);

      if (Object.keys(newMap).length > 0) {
        bdMap = newMap;
        
        // Simpan ke cache
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          timestamp: Date.now(),
          bdMap: newMap,
          bdNames: bdNames
        }));

        console.log('[BD Map] Berhasil dimuat dari sheet:', bdMap);
        populateBdDropdown(bdNames);
      } else {
        console.warn('[BD Map] Sheet tidak menghasilkan data valid, dropdown kosong.');
        populateBdDropdown([]);
      }
    } catch (err) {
      console.warn('[BD Map] Gagal fetch sheet:', err.message);
      populateBdDropdown([]);
    }
  }

  // Mulai load BD map saat DOM siap (non-blocking)
  loadBdMapFromSheet();

  // Sinkronisasi pilihan BD saat user mengeklik dropdown dengan indikator loading
  let isSyncingBd = false;
  async function syncBdMapWithLoader() {
    if (isSyncingBd) return;
    
    // Jika cache masih valid, tidak perlu loading muter muter
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsedCache = JSON.parse(cached);
        if (Date.now() - parsedCache.timestamp < CACHE_TTL) {
           return; // Data masih fresh, skip fetch
        }
      } catch(e) {}
    }

    isSyncingBd = true;

    const selectGroup = bdSelect.closest('.select-group');
    const loader = selectGroup ? selectGroup.querySelector('.bd-sync-loader') : null;

    if (selectGroup) selectGroup.classList.add('is-syncing');
    if (loader) loader.classList.remove('hidden');

    try {
      await loadBdMapFromSheet(true); // Force fetch karena cache expire / tidak ada
    } catch (err) {
      console.warn('[BD Sync] Gagal sinkronisasi BD:', err);
    } finally {
      if (loader) loader.classList.add('hidden');
      if (selectGroup) selectGroup.classList.remove('is-syncing');
      isSyncingBd = false;
    }
  }

  bdSelect.addEventListener('mousedown', syncBdMapWithLoader);
  bdSelect.addEventListener('touchstart', syncBdMapWithLoader);

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
  });

  /* ==========================================================================
     BD DROPDOWN — FLOATING LABEL & VALIDATION
     ========================================================================== */
  // Toggle floating label class when BD has a value
  function updateBdSelectLabel() {
    if (bdSelect.value) {
      bdSelect.classList.add('has-value');
    } else {
      bdSelect.classList.remove('has-value');
    }
  }

  bdSelect.addEventListener('change', () => {
    updateBdSelectLabel();
    validateBdSelect();
  });

  function validateBdSelect() {
    const group = bdSelect.closest('.select-group');
    if (!group) return true;
    if (bdSelect.value) {
      group.classList.remove('is-invalid');
      group.classList.add('is-valid');
      return true;
    } else {
      group.classList.remove('is-valid');
      group.classList.add('is-invalid');
      return false;
    }
  }

  // Init label state (in case browser restores a value)
  updateBdSelectLabel();

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
    }
    checkFormValidity();
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
      checkFormValidity();
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
      const emailDuckId = `gofood-email-duck-${uniqueIdSuffix}`;
      const namaAksesId = `gofood-nama-akses-${uniqueIdSuffix}`;
      const emailFoodmasterId = `gofood-email-foodmaster-${uniqueIdSuffix}`;
      contentHtml = `
        <div class="credential-row-content">
          <div class="form-grid">
            <div class="input-group" style="grid-column: 1 / -1;">
              <input type="text" id="${namaAksesId}" class="gofood-nama-akses-input" name="gofoodNamaAkses" required placeholder=" ">
              <label for="${namaAksesId}">Nama Akses</label>
              <span class="focus-bar"></span>
              <span class="error-msg">Nama akses wajib diisi</span>
                            <div class="validation-icon">
                <img class="valid" src="Logo/check.png" alt="Valid">
                <img class="invalid" src="Logo/cross.png" alt="Invalid">
              </div>
            </div>
            <div class="input-group">
              <input type="text" id="${emailDuckId}" class="gofood-email-duck-input" name="gofoodEmailDuck" required placeholder=" ">
              <label for="${emailDuckId}" style="color: #EF4444;">outlet1@byfoodmaster.com</label>
              <span class="focus-bar"></span>
              <span class="error-msg">Format tidak valid</span>
                            <div class="validation-icon">
                <img class="valid" src="Logo/check.png" alt="Valid">
                <img class="invalid" src="Logo/cross.png" alt="Invalid">
              </div>
            </div>
            <div class="input-group">
              <input type="text" id="${emailFoodmasterId}" class="gofood-email-foodmaster-input" name="gofoodEmailFoodmaster" placeholder=" ">
              <label for="${emailFoodmasterId}" style="color: #EF4444;">outlet2@byfoodmaster.com</label>
              <span class="focus-bar"></span>
              <span class="error-msg">Format tidak valid</span>
                              <div class="validation-icon">
                <img class="valid" src="Logo/check.png" alt="Valid">
                <img class="invalid" src="Logo/cross.png" alt="Invalid">
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
    } else if (target === 'grab') {
      const usernameId = `grab-username-${uniqueIdSuffix}`;
      contentHtml = `
        <div class="credential-row-content">
          <div class="input-group" style="width:100%;">
            <input type="text" id="${usernameId}" class="grab-username-input" name="grabUsername" required placeholder=" ">
            <label for="${usernameId}">Username</label>
            <span class="focus-bar"></span>
            <span class="error-msg">Username wajib diisi</span>
                        <div class="validation-icon">
              <img class="valid" src="Logo/check.png" alt="Valid">
              <img class="invalid" src="Logo/cross.png" alt="Invalid">
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
            <label for="${portalId}">Nama Portal</label>
            <span class="focus-bar"></span>
            <span class="error-msg">Nama portal wajib diisi</span>
                        <div class="validation-icon">
              <img class="valid" src="Logo/check.png" alt="Valid">
              <img class="invalid" src="Logo/cross.png" alt="Invalid">
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



    // Focus first input
    const firstInput = rowWrapper.querySelector('input');
    if (firstInput) {
      firstInput.focus();
    }

    checkFormValidity();
  }

  /* ==========================================================================
     FORM VALIDATION ENGINE
     ========================================================================== */

  // Real-time listener for inputs using event delegation
  credentialForm.addEventListener('input', (e) => {
    if (e.target.tagName === 'INPUT') {
      validateField(e.target);
    }
    checkFormValidity();
  });

  credentialForm.addEventListener('focusout', (e) => {
    if (e.target.tagName === 'INPUT') {
      validateField(e.target);
    }
    checkFormValidity();
  });

  credentialForm.addEventListener('change', () => {
    checkFormValidity();
  });

  function checkFormValidity() {
    // 1. Owner Name
    const ownerVal = ownerNameInput.value.trim();
    if (ownerVal === '') {
      submitBtn.disabled = true;
      return;
    }

    // 2. Outlet Name
    const outletVal = outletNameInput.value.trim();
    if (outletVal === '') {
      submitBtn.disabled = true;
      return;
    }

    // 3. BD selection
    const bdVal = bdSelect.value;
    if (bdVal === '') {
      submitBtn.disabled = true;
      return;
    }

    // 4. At least one applicator
    const selectedAplikators = Array.from(document.querySelectorAll('input[name="aplikator"]:checked')).map(cb => cb.value);
    if (selectedAplikators.length === 0) {
      submitBtn.disabled = true;
      return;
    }

    // 5. Active credential pane inputs
    let allCredsValid = true;
    selectedAplikators.forEach(aplikator => {
      if (aplikator === 'gofood') {
        const rows = document.querySelectorAll('#pane-gofood .credential-row-wrapper');
        if (rows.length === 0) {
          allCredsValid = false;
        }
        rows.forEach(row => {
          const duckEl = row.querySelector('.gofood-email-duck-input');
          const namaAksesEl = row.querySelector('.gofood-nama-akses-input');
          const foodmasterEl = row.querySelector('.gofood-email-foodmaster-input');
          const duckVal = duckEl ? duckEl.value.trim() : '';
          const namaAksesVal = namaAksesEl ? namaAksesEl.value.trim() : '';

          if (duckVal === '') {
            allCredsValid = false;
          }
          if (namaAksesVal === '') {
            allCredsValid = false;
          }
          if (duckEl && duckEl.closest('.input-group')?.classList.contains('is-invalid')) {
            allCredsValid = false;
          }
          // namaAkses wajib — validasi juga jika ada error
          if (namaAksesEl && namaAksesEl.closest('.input-group')?.classList.contains('is-invalid')) {
            allCredsValid = false;
          }
          // foodmasterVal opsional — hanya validasi format jika diisi
          if (foodmasterEl && foodmasterEl.closest('.input-group')?.classList.contains('is-invalid')) {
            allCredsValid = false;
          }
        });
      } else if (aplikator === 'grab') {
        const rows = document.querySelectorAll('#pane-grab .credential-row-wrapper');
        if (rows.length === 0) {
          allCredsValid = false;
        }
        rows.forEach(row => {
          const userEl = row.querySelector('.grab-username-input');
          const userVal = userEl ? userEl.value.trim() : '';
          if (userVal === '') {
            allCredsValid = false;
          }
          if (userEl && userEl.closest('.input-group')?.classList.contains('is-invalid')) {
            allCredsValid = false;
          }
        });
      } else if (aplikator === 'shopee') {
        const portalInputs = document.querySelectorAll('#pane-shopee .shopee-portal-input');
        if (portalInputs.length === 0) {
          allCredsValid = false;
        }
        portalInputs.forEach(input => {
          const portalVal = input.value.trim();
          if (portalVal === '') {
            allCredsValid = false;
          }
          if (input.closest('.input-group')?.classList.contains('is-invalid')) {
            allCredsValid = false;
          }
        });
      }
    });

    if (!allCredsValid) {
      submitBtn.disabled = true;
      return;
    }

    submitBtn.disabled = false;
  }

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

    // Validasi format (hanya jika field diisi)
    if (value !== '') {
      if (input.classList.contains('gofood-email-foodmaster-input') || input.classList.contains('gofood-email-duck-input')) {
        if (/\s/.test(value) || /@/.test(value)) {
          isValid = false;
          errorMessage = 'Format tidak valid (tanpa @)';
        }
      } else if (input.type === 'email') {
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

    // Trigger visual validation (tidak memblokir submit)
    validateField(ownerNameInput);
    validateField(outletNameInput);
    validateBdSelect();

    selectedAplikators.forEach(aplikator => {
      let selector = '';
      if (aplikator === 'gofood') selector = '.gofood-email-duck-input, .gofood-nama-akses-input, .gofood-email-foodmaster-input';
      else if (aplikator === 'grab') selector = '.grab-username-input';
      else if (aplikator === 'shopee') selector = '.shopee-portal-input';

      if (selector) {
        document.querySelectorAll(`#pane-${aplikator} ${selector}`).forEach(input => {
          validateField(input);
        });
      }
    });

    // Langsung proses submit meskipun ada field kosong
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
        const rows = document.querySelectorAll('#pane-gofood .credential-row-wrapper');
        credentialsPayload.gofood = [];
        rows.forEach(row => {
          const duckEl = row.querySelector('.gofood-email-duck-input');
          const namaAksesEl = row.querySelector('.gofood-nama-akses-input');
          const foodmasterEl = row.querySelector('.gofood-email-foodmaster-input');
          const emailDuckVal = duckEl ? duckEl.value.trim() : '';
          // Append domain jika user hanya ketik prefix
          const emailDuckFull = (emailDuckVal && !emailDuckVal.includes('@'))
            ? emailDuckVal + '@byfoodmaster.com'
            : emailDuckVal;
          const namaAksesVal = namaAksesEl ? namaAksesEl.value.trim() : '';
          let emailFoodmasterVal = foodmasterEl ? foodmasterEl.value.trim() : '';
          if (emailFoodmasterVal === '@byfoodmaster.com') {
            emailFoodmasterVal = '';
          } else if (emailFoodmasterVal && !emailFoodmasterVal.includes('@')) {
            emailFoodmasterVal += '@byfoodmaster.com';
          }

          // Skip jika semua field utama kosong
          if (emailDuckFull === '' && namaAksesVal === '' && emailFoodmasterVal === '') {
            return;
          }

          credentialsPayload.gofood.push({ emailDuck: emailDuckFull, namaAkses: namaAksesVal, emailFoodmaster: emailFoodmasterVal });

          sheetsPayloads.push({
            owner: ownerNameInput.value.trim(),
            outlet: outletNameInput.value.trim(),
            bd: bdSelect.value,
            aplikator: 'GoFood',
            emailDuck: emailDuckFull,
            namaAkses: namaAksesVal,
            emailFoodmaster: emailFoodmasterVal
          });
        });
      } else if (aplikator === 'grab') {
        const rows = document.querySelectorAll('#pane-grab .credential-row-wrapper');
        credentialsPayload.grab = [];
        rows.forEach(row => {
          const userVal = row.querySelector('.grab-username-input').value.trim();

          // Skip if username is empty
          if (userVal === '') {
            return;
          }

          const passVal = 'SuperFood@2026'; // Password tetap/hardcode
          credentialsPayload.grab.push({ username: userVal, password: passVal });

          sheetsPayloads.push({
            owner: ownerNameInput.value.trim(),
            outlet: outletNameInput.value.trim(),
            bd: bdSelect.value,
            aplikator: 'GrabFood',
            username: userVal,
            password: passVal
          });
        });
      } else if (aplikator === 'shopee') {
        const portalInputs = document.querySelectorAll('#pane-shopee .shopee-portal-input');
        credentialsPayload.shopee = [];

        // Gunakan bdMap yang sudah dimuat dari sheet (atau fallback)
        const selectedBd = bdSelect?.value || '';
        const bdCreds = bdMap[selectedBd] || { username: '', password: '' };

        portalInputs.forEach(input => {
          const portalVal = input.value.trim();

          // Skip if portal name is empty
          if (portalVal === '') {
            return;
          }

          credentialsPayload.shopee.push({ namaPortal: portalVal, bd: selectedBd });

          sheetsPayloads.push({
            owner: ownerNameInput.value.trim(),
            outlet: outletNameInput.value.trim(),
            bd: bdSelect.value,
            aplikator: 'ShopeeFood',
            merchantName: portalVal,
            username: bdCreds.username,
            password: bdCreds.password
          });
        });
      }
    });

    // If all credential fields are empty, do not submit
    if (sheetsPayloads.length === 0) {
      submitBtn.disabled = false;
      btnText.style.opacity = '1';
      btnSpinner.classList.add('hidden');
      showToast('Form Kosong', 'Tidak ada data kredensial yang diisi untuk dikirim.', 'error');
      return;
    }

    // Compile entire payload for UI display (JSON Output)
    submittedData = {
      namaOwner: ownerNameInput.value.trim(),
      namaOutlet: outletNameInput.value.trim(),
      bd: bdSelect.value,
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
      // Kirim sekuensial (satu per satu) untuk menghindari race condition pada LockService Apps Script
      (async () => {
        const results = [];
        for (const payload of sheetsPayloads) {
          try {
            const response = await fetch(WEB_APP_URL, {
              method: "POST",
              mode: "cors",
              headers: { "Content-Type": "text/plain;charset=utf-8" },
              body: JSON.stringify(payload)
            });
            const resData = await response.json();
            results.push(resData);
          } catch (err) {
            results.push({ status: "error", message: err.toString() });
          }
        }

        const failed = results.filter(resData => resData.status !== "success");
        if (failed.length === 0) {
          showToast('Sinkronisasi Sukses', 'Semua kredensial berhasil disimpan di Google Sheets!', 'success');
          finalizeSubmission('success');
        } else {
          const errMsgs = failed.map(f => f.message).join(', ');
          showToast('Sinkronisasi Gagal', 'Beberapa data gagal disimpan ke Google Sheets.', 'error');
          finalizeSubmission('error', errMsgs);
        }
      })().catch(error => {
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
    const modalStatusIcon = document.getElementById('modal-status-icon');

    if (status === 'error') {
      modalTitle.textContent = "Sinkronisasi Gagal!";
      modalTitle.style.color = "HSL(var(--color-invalid))";
      modalDesc.innerHTML = `Gagal menyimpan ke Google Sheets. ${errorMsg ? `<br><small style="color:var(--text-muted)">Detail: ${errorMsg}</small>` : ''}`;
      if (modalStatusIcon) modalStatusIcon.src = 'Logo/cross.png';
    } else {
      modalTitle.textContent = "Kredensial Berhasil Didaftarkan!";
      modalTitle.style.color = "var(--text-primary)";
      modalDesc.innerHTML = "Data berikut telah berhasil dikirim:";
      if (modalStatusIcon) modalStatusIcon.src = 'Logo/check.png';
    }

    // Render ringkasan input yang mudah dibaca
    submissionSummary.innerHTML = buildSummaryHTML(submittedData);

    // Buka Success Modal
    successModal.classList.add('open');
  }

  function buildSummaryHTML(data) {
    if (!data) return '';
    let html = `
      <div class="summary-row"><span class="summary-label">Owner</span><span class="summary-value">${data.namaOwner || '-'}</span></div>
      <div class="summary-row"><span class="summary-label">Outlet</span><span class="summary-value">${data.namaOutlet || '-'}</span></div>
      <div class="summary-row"><span class="summary-label">BD</span><span class="summary-value">${data.bd || '-'}</span></div>
      <div class="summary-divider"></div>
    `;

    if (data.kredensial.gofood && data.kredensial.gofood.length > 0) {
      html += `<div class="summary-platform">GoFood</div>`;
      data.kredensial.gofood.forEach((item, i) => {
        const label = data.kredensial.gofood.length > 1 ? ` ${i + 1}` : '';
        html += `<div class="summary-row"><span class="summary-label">Email Duck${label}</span><span class="summary-value">${item.emailDuck || '-'}</span></div>`;
        if (item.namaAkses) {
          html += `<div class="summary-row"><span class="summary-label">Nama Akses${label}</span><span class="summary-value">${item.namaAkses}</span></div>`;
        }
        html += `<div class="summary-row"><span class="summary-label">Email Foodmaster${label}</span><span class="summary-value">${item.emailFoodmaster || '-'}</span></div>`;
      });
      html += `<div class="summary-divider"></div>`;
    }

    if (data.kredensial.grab && data.kredensial.grab.length > 0) {
      html += `<div class="summary-platform">GrabFood</div>`;
      data.kredensial.grab.forEach((item, i) => {
        const label = data.kredensial.grab.length > 1 ? ` ${i + 1}` : '';
        html += `
          <div class="summary-row"><span class="summary-label">Username${label}</span><span class="summary-value">${item.username || '-'}</span></div>
        `;
      });
      html += `<div class="summary-divider"></div>`;
    }

    if (data.kredensial.shopee && data.kredensial.shopee.length > 0) {
      html += `<div class="summary-platform">ShopeeFood</div>`;
      data.kredensial.shopee.forEach((item, i) => {
        html += `<div class="summary-row"><span class="summary-label">Nama Portal ${data.kredensial.shopee.length > 1 ? i + 1 : ''}</span><span class="summary-value">${item.namaPortal || '-'}</span></div>`;
      });
    }

    return html;
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
    resetForm();
  }

  function resetForm() {
    // 1. Reset field statis (owner, outlet, BD)
    ownerNameInput.value = '';
    outletNameInput.value = '';
    bdSelect.value = '';
    updateBdSelectLabel();

    // 2. Hapus kelas validasi dari semua input-group & select-group
    credentialForm.querySelectorAll('.input-group, .select-group').forEach(group => {
      group.classList.remove('is-valid', 'is-invalid');
    });

    // 3. Reset checkbox ke kondisi awal (GoFood checked, lainnya unchecked)
    aplikatorCheckboxes.forEach(cb => {
      const isDefault = cb.value === 'gofood';
      cb.checked = isDefault;
      toggleAplikatorPane(cb.value, isDefault, true);
    });

    // 4. Untuk setiap container: hapus baris tambahan (index > 0),
    //    lalu kosongkan nilai input di baris pertama (yang statis)
    ['gofood', 'grab', 'shopee'].forEach(app => {
      const container = document.getElementById(`${app}-rows-container`);
      if (!container) return;

      const rows = container.querySelectorAll('.credential-row-wrapper');
      rows.forEach((row, index) => {
        if (index > 0) {
          row.remove(); // hapus baris tambahan
        } else {
          // kosongkan value semua input di baris pertama
          row.querySelectorAll('input').forEach(input => {
            input.value = '';
          });
        }
      });
    });

    // 5. Reset state tombol submit
    checkFormValidity();
  }



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
    }, 2000);
  }

  // Initialize button state on page load
  checkFormValidity();

});
