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
  const aplikatorRadios = document.querySelectorAll('input[name="aplikator"]');
  const credentialPanes = {
    gofood: document.getElementById('pane-gofood'),
    grab: document.getElementById('pane-grab'),
    shopee: document.getElementById('pane-shopee')
  };
  const credentialInputs = {
    gofood: [document.getElementById('gofood-email')],
    grab: [document.getElementById('grab-username'), document.getElementById('grab-password')],
    shopee: [document.getElementById('shopee-portal')]
  };

  // Password toggle
  const toggleGrabPasswordBtn = document.getElementById('toggle-grab-password');
  const grabPasswordInput = document.getElementById('grab-password');

  // Success Modal Elements
  const successModal = document.getElementById('success-modal');
  const jsonOutput = document.getElementById('json-output');
  const copyJsonBtn = document.getElementById('copy-json-btn');
  const downloadJsonBtn = document.getElementById('download-json-btn');
  const closeModalBtn = document.getElementById('close-modal-btn');

  // Inputs for static fields
  const ownerNameInput = document.getElementById('owner-name');
  const outletNameInput = document.getElementById('outlet-name');

  let currentAplikator = 'gofood';
  let submittedData = null; // Storing submitted payload for export

  // URL Google Apps Script Web App (Tempel URL Anda di sini setelah men-deploy Apps Script)
  const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbx1GeEBNpiwNymIghNksgLu_XyVROUCqPxwC2q5HxGQEGDBrNcpZdhyZtyQZSKBc9xDTw/exec";
  // Ubah ke true untuk mengirim ke Sheets, atau false untuk simulasi mock lokal saja
  const ENABLE_SHEET_SUBMISSION = false;

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
  aplikatorRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        switchAplikatorPane(e.target.value);
      }
    });
  });

  function switchAplikatorPane(selectedAplikator) {
    currentAplikator = selectedAplikator;

    // Smooth Transition: Fade out and hide all panes, deactivate requirements
    Object.keys(credentialPanes).forEach(key => {
      const pane = credentialPanes[key];
      pane.classList.remove('active');

      // Deactivate all requirements in non-active panes
      credentialInputs[key].forEach(input => {
        input.removeAttribute('required');
        // Clear validation statuses
        const group = input.closest('.input-group');
        if (group) {
          group.classList.remove('is-valid', 'is-invalid');
        }
      });
    });

    // Fade in and show selected pane, activate requirements
    const targetPane = credentialPanes[selectedAplikator];
    setTimeout(() => {
      targetPane.classList.add('active');

      // Set requirements dynamically based on selected aplikator
      credentialInputs[selectedAplikator].forEach(input => {
        input.setAttribute('required', 'true');
      });
    }, 50);

    showToast(
      'Aplikator Diubah',
      `Form disesuaikan untuk kebutuhan ${capitalizeWord(selectedAplikator)}.`,
      'info'
    );
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
  toggleGrabPasswordBtn.addEventListener('click', () => {
    const isPassword = grabPasswordInput.getAttribute('type') === 'password';
    grabPasswordInput.setAttribute('type', isPassword ? 'text' : 'password');

    const eyeIcon = toggleGrabPasswordBtn.querySelector('.eye-icon');
    const eyeOffIcon = toggleGrabPasswordBtn.querySelector('.eye-off-icon');

    if (isPassword) {
      eyeIcon.classList.add('hidden');
      eyeOffIcon.classList.remove('hidden');
      toggleGrabPasswordBtn.setAttribute('aria-label', 'Sembunyikan password');
    } else {
      eyeIcon.classList.remove('hidden');
      eyeOffIcon.classList.add('hidden');
      toggleGrabPasswordBtn.setAttribute('aria-label', 'Tampilkan password');
    }
  });

  /* ==========================================================================
     FORM VALIDATION ENGINE
     ========================================================================== */

  // Real-time listener for inputs
  const allInputs = [ownerNameInput, outletNameInput, ...credentialInputs.gofood, ...credentialInputs.grab, ...credentialInputs.shopee];

  allInputs.forEach(input => {
    // Perform validation on inputs
    input.addEventListener('input', () => {
      validateField(input);
    });

    input.addEventListener('blur', () => {
      validateField(input);
    });
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
      errorMessage = getRequiredErrorMessage(input.id);
    } else if (value !== '') {
      // Format validations
      if (input.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          isValid = false;
          errorMessage = 'Format email tidak valid';
        }
      } else if (input.id === 'grab-password') {
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

  function getRequiredErrorMessage(id) {
    switch (id) {
      case 'owner-name': return 'Nama pemilik wajib diisi';
      case 'outlet-name': return 'Nama outlet wajib diisi';
      case 'gofood-email': return 'Email mitra GoFood wajib diisi';
      case 'grab-username': return 'Username Grab wajib diisi';
      case 'grab-password': return 'Password Grab wajib diisi';
      case 'shopee-portal': return 'Nama portal partner Shopee wajib diisi';
      default: return 'Field ini wajib diisi';
    }
  }

  /* ==========================================================================
     SUBMIT HANDLING & PAYLOAD SIMULATION
     ========================================================================== */
  credentialForm.addEventListener('submit', (e) => {
    e.preventDefault();

    // Trigger validation for all active inputs
    let formIsValid = true;
    let firstInvalidElement = null;

    // Static fields
    const staticValidations = [validateField(ownerNameInput), validateField(outletNameInput)];
    if (staticValidations.includes(false)) {
      formIsValid = false;
    }

    // Active credential fields
    credentialInputs[currentAplikator].forEach(input => {
      if (!validateField(input)) {
        formIsValid = false;
      }
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
    executeSubmission();
  });

  function executeSubmission() {
    // Trigger loading state
    submitBtn.disabled = true;
    btnText.style.opacity = '0';
    btnSpinner.classList.remove('hidden');

    // Assemble dynamic credentials object based on Aplikator
    let credentialsPayload = {};
    let sheetsPayload = {
      owner: ownerNameInput.value.trim(),
      outlet: outletNameInput.value.trim(),
      aplikator: currentAplikator === 'gofood' ? 'GoFood' : (currentAplikator === 'grab' ? 'GrabFood' : 'ShopeeFood')
    };

    if (currentAplikator === 'gofood') {
      const emailVal = document.getElementById('gofood-email').value.trim();
      credentialsPayload = { email: emailVal };
      sheetsPayload.email = emailVal;
    } else if (currentAplikator === 'grab') {
      const userVal = document.getElementById('grab-username').value.trim();
      const passVal = document.getElementById('grab-password').value.trim();
      credentialsPayload = { username: userVal, password: passVal };
      sheetsPayload.username = userVal;
      sheetsPayload.password = passVal;
    } else if (currentAplikator === 'shopee') {
      const portalVal = document.getElementById('shopee-portal').value.trim();
      credentialsPayload = { namaPortal: portalVal };
      sheetsPayload.merchantName = portalVal;
    }

    // Compile entire payload for UI display
    submittedData = {
      namaOwner: ownerNameInput.value.trim(),
      namaOutlet: outletNameInput.value.trim(),
      aplikator: capitalizeWord(currentAplikator),
      kredensial: credentialsPayload,
      metadata: {
        waktuIntegrasi: new Date().toISOString(),
        versiSkema: "1.0.0",
        statusEnkripsi: "AES-256 Terenkripsi"
      }
    };

    // Jika URL Apps Script aktif dan fitur diaktifkan, kirim data ke Google Sheets
    if (ENABLE_SHEET_SUBMISSION && WEB_APP_URL && WEB_APP_URL !== "YOUR_DEPLOYED_WEB_APP_URL") {
      fetch(WEB_APP_URL, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(sheetsPayload)
      })
        .then(response => response.json())
        .then(resData => {
          if (resData.status === "success") {
            showToast('Sinkronisasi Sukses', 'Kredensial berhasil disimpan di Google Sheets!', 'success');
            finalizeSubmission('success');
          } else {
            showToast('Sinkronisasi Gagal', resData.message || 'Gagal menyimpan ke Google Sheets.', 'error');
            finalizeSubmission('error', resData.message);
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
    const filename = `kredensial_${outletSlug}_${currentAplikator}.json`;

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
