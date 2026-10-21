/**
 * Student Barcode Attendance Management System
 * Complete client-side application logic (Pure HTML/JS/CSS, no local server required).
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. APPLICATION STATE & DATABASE (IndexedDB + localStorage Fallback)
  // ==========================================================================
  const DB_NAME = 'StudentAttendanceDB';
  const DB_VERSION = 1;

  const state = {
    db: null,
    students: [],
    attendance: [],
    settings: {
      institutionName: 'ST. JUDE INTERNATIONAL ACADEMY',
      soundEnabled: true,
      autoClearSeconds: 8,
      theme: 'light',
      autoStartCamera: false
    },
    activeSection: 'view-live-monitor',
    scannerBuffer: '',
    scannerLastKeyTime: 0,
    clearCardTimer: null,
    selectedStudentForCard: null,
    html5QrCode: null,
    isCameraScanning: false,
    selectedCameraId: null,
    lastCameraScannedCode: '',
    lastCameraScanTime: 0,
    webcamMediaStream: null,
    activeSnapshotTarget: null
  };

  // Sample seed data to provide instant out-of-the-box functionality
  const INITIAL_STUDENTS = [
    {
      id: 'STU-1001',
      studentId: 'STU-1001',
      fullName: 'Alex Johnson',
      className: 'Grade 10-A',
      barcode: 'STU-1001',
      photo: '',
      createdAt: new Date().toISOString()
    },
    {
      id: 'STU-1002',
      studentId: 'STU-1002',
      fullName: 'Emma Watson',
      className: 'Grade 10-B',
      barcode: 'STU-1002',
      photo: '',
      createdAt: new Date().toISOString()
    },
    {
      id: 'STU-1003',
      studentId: 'STU-1003',
      fullName: 'Michael Brown',
      className: 'Grade 11-A',
      barcode: 'STU-1003',
      photo: '',
      createdAt: new Date().toISOString()
    },
    {
      id: 'STU-1004',
      studentId: 'STU-1004',
      fullName: 'Sophia Martinez',
      className: 'Grade 11-B',
      barcode: 'STU-1004',
      photo: '',
      createdAt: new Date().toISOString()
    },
    {
      id: 'STU-1005',
      studentId: 'STU-1005',
      fullName: 'Liam Davis',
      className: 'Grade 12-A',
      barcode: 'STU-1005',
      photo: '',
      createdAt: new Date().toISOString()
    }
  ];

  // Helper: Open or initialize IndexedDB
  function initDatabase() {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB not supported, falling back to localStorage');
        initLocalStorageFallback();
        return resolve();
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('students')) {
          db.createObjectStore('students', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('attendance')) {
          const attStore = db.createObjectStore('attendance', { keyPath: 'id', autoIncrement: true });
          attStore.createIndex('studentId', 'studentId', { unique: false });
          attStore.createIndex('date', 'date', { unique: false });
          attStore.createIndex('barcode', 'barcode', { unique: false });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = async (event) => {
        state.db = event.target.result;
        await loadAllDataFromDB();
        resolve();
      };

      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        initLocalStorageFallback();
        resolve();
      };
    });
  }

  function initLocalStorageFallback() {
    try {
      const storedStudents = localStorage.getItem('sa_students');
      state.students = storedStudents ? JSON.parse(storedStudents) : [...INITIAL_STUDENTS];
      const storedAtt = localStorage.getItem('sa_attendance');
      state.attendance = storedAtt ? JSON.parse(storedAtt) : [];
      const storedSettings = localStorage.getItem('sa_settings');
      if (storedSettings) state.settings = { ...state.settings, ...JSON.parse(storedSettings) };
    } catch (e) {
      state.students = [...INITIAL_STUDENTS];
      state.attendance = [];
    }
  }

  async function loadAllDataFromDB() {
    if (!state.db) return;

    return new Promise((resolve) => {
      const tx = state.db.transaction(['students', 'attendance', 'settings'], 'readonly');
      const studentStore = tx.objectStore('students');
      const attStore = tx.objectStore('attendance');
      const setStore = tx.objectStore('settings');

      const reqStudents = studentStore.getAll();
      const reqAtt = attStore.getAll();
      const reqSet = setStore.getAll();

      tx.oncomplete = async () => {
        state.students = reqStudents.result || [];
        state.attendance = reqAtt.result || [];
        const settingsArr = reqSet.result || [];
        settingsArr.forEach((item) => {
          if (item && item.key) state.settings[item.key] = item.value;
        });

        // Seed if no students found
        if (state.students.length === 0) {
          await seedInitialStudents();
        }

        resolve();
      };

      tx.onerror = () => {
        resolve();
      };
    });
  }

  async function seedInitialStudents() {
    for (const student of INITIAL_STUDENTS) {
      await saveStudentToDB(student);
    }
    state.students = [...INITIAL_STUDENTS];
  }

  async function saveStudentToDB(student) {
    if (state.db) {
      return new Promise((resolve, reject) => {
        const tx = state.db.transaction(['students'], 'readwrite');
        const store = tx.objectStore('students');
        const req = store.put(student);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } else {
      const index = state.students.findIndex(s => s.id === student.id);
      if (index >= 0) state.students[index] = student;
      else state.students.push(student);
      localStorage.setItem('sa_students', JSON.stringify(state.students));
    }
  }

  async function deleteStudentFromDB(studentId) {
    if (state.db) {
      return new Promise((resolve, reject) => {
        const tx = state.db.transaction(['students'], 'readwrite');
        const store = tx.objectStore('students');
        const req = store.delete(studentId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } else {
      state.students = state.students.filter(s => s.id !== studentId);
      localStorage.setItem('sa_students', JSON.stringify(state.students));
    }
  }

  async function saveAttendanceToDB(record) {
    if (state.db) {
      return new Promise((resolve, reject) => {
        const tx = state.db.transaction(['attendance'], 'readwrite');
        const store = tx.objectStore('attendance');
        const req = store.add(record);
        req.onsuccess = (e) => {
          record.id = e.target.result;
          resolve(record);
        };
        req.onerror = () => reject(req.error);
      });
    } else {
      record.id = Date.now() + Math.floor(Math.random() * 1000);
      state.attendance.push(record);
      localStorage.setItem('sa_attendance', JSON.stringify(state.attendance));
      return record;
    }
  }

  async function saveSettingToDB(key, value) {
    state.settings[key] = value;
    if (state.db) {
      const tx = state.db.transaction(['settings'], 'readwrite');
      tx.objectStore('settings').put({ key, value });
    } else {
      localStorage.setItem('sa_settings', JSON.stringify(state.settings));
    }
  }

  // ==========================================================================
  // 2. AUDIO SYNTHESIS ENGINE (Web Audio API - 100% Offline Chimes & Beeps)
  // ==========================================================================
  let audioCtx = null;

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSuccessChime() {
    if (!state.settings.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      // High-pitched pleasant ascending two-tone chime (523Hz C5 -> 659Hz E5 -> 784Hz G5)
      const freqs = [523.25, 659.25, 783.99];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.2, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.35);
      });
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  function playWarningBeep() {
    if (!state.settings.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      // Double medium beep (440Hz A4)
      [0, 0.15].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = 440;
        gain.gain.setValueAtTime(0.25, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.1);
      });
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  function playErrorBuzz() {
    if (!state.settings.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      // Low buzz (160Hz sawtooth)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 160;
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  // ==========================================================================
  // 3. DATE & TIME UTILITIES
  // ==========================================================================
  function getTodayDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
    return dateStr;
  }

  function getFormattedCurrentTime() {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  }

  // ==========================================================================
  // 4. BARCODE SCANNER ENGINE (USB Keyboard Scanner + Input Field Support)
  // ==========================================================================
  function initBarcodeScanner() {
    const scannerInput = document.getElementById('quick-scanner-input');

    // Auto-focus the scanner input when clicking into the monitor view
    document.addEventListener('click', (e) => {
      if (state.activeSection === 'view-live-monitor' && !e.target.closest('button, input, select, textarea, a')) {
        if (scannerInput) scannerInput.focus();
      }
    });

    // Form submit / Enter on the visible input box
    if (scannerInput) {
      scannerInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const code = scannerInput.value.trim();
          if (code) {
            handleBarcodeScan(code);
            scannerInput.value = '';
          }
        }
      });
    }

    // Global Key Listener for USB Barcode Scanners (HID Keyboard Emulation)
    // Most USB barcode scanners output characters rapidly (< 50ms interval) ending with Enter.
    window.addEventListener('keydown', (e) => {
      // If user is actively typing in a form field (other than the scanner input), don't intercept standard typing
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');

      if (isInputFocused && activeEl.id !== 'quick-scanner-input') {
        return; // Allow standard form editing
      }

      const currentTime = Date.now();

      if (e.key === 'Enter') {
        if (state.scannerBuffer.length > 0) {
          e.preventDefault();
          const scannedCode = state.scannerBuffer.trim();
          state.scannerBuffer = '';
          if (scannedCode) {
            handleBarcodeScan(scannedCode);
            if (scannerInput) scannerInput.value = '';
          }
        }
        return;
      }

      // Check if character is a printable standard key
      if (e.key.length === 1) {
        // If the gap between keys is longer than 150ms, assume new sequence
        if (currentTime - state.scannerLastKeyTime > 150) {
          state.scannerBuffer = '';
        }
        state.scannerBuffer += e.key;
        state.scannerLastKeyTime = currentTime;
      }
    });
  }

  // Main Barcode Processing Core
  async function handleBarcodeScan(rawBarcode) {
    const cleanCode = rawBarcode.trim();
    if (!cleanCode) return;

    // Search for student with matching barcode or student ID (case-insensitive)
    const student = state.students.find(
      (s) => (s.barcode && s.barcode.toLowerCase() === cleanCode.toLowerCase()) ||
             (s.studentId && s.studentId.toLowerCase() === cleanCode.toLowerCase())
    );

    const today = getTodayDateString();
    const timeNow = getFormattedCurrentTime();

    // 1. Invalid or Unregistered Barcode
    if (!student) {
      playErrorBuzz();
      renderLiveCardError(cleanCode);
      addScanToFeed({
        type: 'error',
        studentName: 'Unregistered Barcode',
        studentId: cleanCode,
        className: 'Unknown',
        time: timeNow,
        status: 'Invalid Barcode'
      });
      showToast(`Invalid Barcode: "${cleanCode}" is not registered.`, 'toast-danger');
      return;
    }

    // 2. Prevent Duplicate Attendance for the same student on the same day
    const existingRecord = state.attendance.find(
      (a) => a.studentId === student.studentId && a.date === today
    );

    if (existingRecord) {
      playWarningBeep();
      renderLiveCardDuplicate(student, existingRecord);
      addScanToFeed({
        type: 'warning',
        studentName: student.fullName,
        studentId: student.studentId,
        className: student.className,
        time: timeNow,
        status: 'Duplicate (Already Marked)'
      });
      showToast(`Duplicate: ${student.fullName} was already marked today at ${existingRecord.time}.`, 'toast-warning');
      return;
    }

    // 3. Valid New Attendance
    const newRecord = {
      studentId: student.studentId,
      studentName: student.fullName,
      className: student.className,
      barcode: student.barcode,
      date: today,
      time: timeNow,
      timestamp: Date.now(),
      status: 'Present'
    };

    const savedRecord = await saveAttendanceToDB(newRecord);
    state.attendance.unshift(savedRecord);

    playSuccessChime();
    renderLiveCardSuccess(student, savedRecord);
    addScanToFeed({
      type: 'success',
      studentName: student.fullName,
      studentId: student.studentId,
      className: student.className,
      time: timeNow,
      status: 'Present'
    });

    updateTodayStats();
    showToast(`Attendance Marked: ${student.fullName} (${student.className})`, 'toast-success');

    // If attendance records view is open, refresh table
    if (state.activeSection === 'view-attendance-records') {
      renderAttendanceTable();
    }
  }

  // ==========================================================================
  // 5. LIVE ATTENDANCE MONITORING SCREEN (Module 2)
  // Distance-readable on computer monitors & TVs
  // ==========================================================================
  function updateLiveClock() {
    const clockEl = document.getElementById('live-clock-display');
    const dateEl = document.getElementById('live-date-display');
    if (clockEl) {
      clockEl.textContent = getFormattedCurrentTime();
    }
    if (dateEl) {
      const d = new Date();
      dateEl.textContent = d.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  }

  function updateTodayStats() {
    const today = getTodayDateString();
    const todayCount = state.attendance.filter(a => a.date === today && a.status === 'Present').length;
    const totalStudents = state.students.length;

    const countEl = document.getElementById('stat-today-present');
    const totalEl = document.getElementById('stat-total-students');

    if (countEl) countEl.textContent = todayCount;
    if (totalEl) totalEl.textContent = totalStudents;
  }

  function renderLiveCardSuccess(student, record) {
    const cardEl = document.getElementById('live-monitor-card');
    if (!cardEl) return;

    clearTimeout(state.clearCardTimer);
    cardEl.className = 'live-card state-success';

    const photoSrc = student.photo || generateDefaultAvatar(student.fullName);

    cardEl.innerHTML = `
      <div class="live-scanned-state">
        <div class="live-status-badge badge-success">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          ATTENDANCE RECORDED
        </div>

        <div class="live-student-photo-wrapper">
          <img src="${photoSrc}" alt="${student.fullName}" class="live-student-photo" />
        </div>

        <div class="live-student-name">${student.fullName}</div>

        <div class="live-student-meta-grid">
          <div class="meta-pill">
            <span>Student ID:</span> ${student.studentId}
          </div>
          <div class="meta-pill">
            <span>Class:</span> ${student.className}
          </div>
          <div class="meta-pill">
            <span>Barcode:</span> ${student.barcode}
          </div>
        </div>

        <div class="live-scan-time-banner">
          Time Recorded: ${record.time} &bull; ${formatDisplayDate(record.date)}
        </div>
      </div>
    `;

    // Auto reset to idle prompt after timeout
    state.clearCardTimer = setTimeout(() => {
      renderLiveCardIdle();
    }, (state.settings.autoClearSeconds || 8) * 1000);
  }

  function renderLiveCardDuplicate(student, existingRecord) {
    const cardEl = document.getElementById('live-monitor-card');
    if (!cardEl) return;

    clearTimeout(state.clearCardTimer);
    cardEl.className = 'live-card state-duplicate';

    const photoSrc = student.photo || generateDefaultAvatar(student.fullName);

    cardEl.innerHTML = `
      <div class="live-scanned-state">
        <div class="live-status-badge badge-duplicate">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          ALREADY MARKED TODAY
        </div>

        <div class="live-student-photo-wrapper" style="background: linear-gradient(135deg, #f59e0b, #d97706);">
          <img src="${photoSrc}" alt="${student.fullName}" class="live-student-photo" />
        </div>

        <div class="live-student-name">${student.fullName}</div>

        <div class="live-student-meta-grid">
          <div class="meta-pill">
            <span>Student ID:</span> ${student.studentId}
          </div>
          <div class="meta-pill">
            <span>Class:</span> ${student.className}
          </div>
        </div>

        <div class="live-scan-time-banner" style="background: #fef3c7; color: #b45309;">
          Duplicate Detected &bull; First Recorded At: ${existingRecord.time} Today
        </div>
      </div>
    `;

    state.clearCardTimer = setTimeout(() => {
      renderLiveCardIdle();
    }, 7000);
  }

  function renderLiveCardError(scannedCode) {
    const cardEl = document.getElementById('live-monitor-card');
    if (!cardEl) return;

    clearTimeout(state.clearCardTimer);
    cardEl.className = 'live-card state-error';

    cardEl.innerHTML = `
      <div class="live-scanned-state">
        <div class="live-status-badge badge-error">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          INVALID BARCODE
        </div>

        <div class="scanner-target-anim" style="border-color: #ef4444; width: 100px; height: 100px; margin-top: 1rem;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>

        <div class="live-student-name" style="color: #dc2626;">Student Not Registered</div>
        <div class="idle-subtitle">Scanned Barcode: <code style="font-size: 1.1rem; background: #fee2e2; padding: 0.2rem 0.6rem; border-radius: 4px; color: #991b1b;">${scannedCode}</code></div>
        <div style="font-size: 0.9rem; color: var(--text-muted); margin-top: 0.5rem;">
          Please register the student first in the "Student Registration" tab.
        </div>
      </div>
    `;

    state.clearCardTimer = setTimeout(() => {
      renderLiveCardIdle();
    }, 6000);
  }

  function renderLiveCardIdle() {
    const cardEl = document.getElementById('live-monitor-card');
    if (!cardEl) return;

    cardEl.className = 'live-card';
    cardEl.innerHTML = `
      <div class="live-idle-state">
        <div class="scanner-target-anim">
          <div class="scanner-beam"></div>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
            <path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
            <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path>
            <path d="M7 21H5a2 2 0 0 1-2-2v-2"></path>
            <line x1="7" y1="8" x2="7" y2="16"></line>
            <line x1="10" y1="8" x2="10" y2="16"></line>
            <line x1="14" y1="8" x2="14" y2="16"></line>
            <line x1="17" y1="8" x2="17" y2="16"></line>
          </svg>
        </div>
        <div class="idle-title">Ready for Barcode Scan</div>
        <div class="idle-subtitle">
          Present student ID card to the USB barcode scanner. Attendance will be recorded and announced automatically.
        </div>
      </div>
    `;
  }

  function addScanToFeed(item) {
    const feedContainer = document.getElementById('recent-scans-feed');
    if (!feedContainer) return;

    const div = document.createElement('div');
    div.className = 'feed-item';

    let tagClass = 'tag-success';
    if (item.type === 'warning') tagClass = 'tag-warning';
    if (item.type === 'error') tagClass = 'tag-danger';

    div.innerHTML = `
      <div class="feed-student-info">
        <div class="feed-student-name">${item.studentName}</div>
        <div class="feed-student-sub">${item.studentId} &bull; ${item.className}</div>
      </div>
      <div class="feed-time-badge">
        <span class="feed-time">${item.time}</span>
        <span class="badge-tag-sm ${tagClass}">${item.status}</span>
      </div>
    `;

    feedContainer.prepend(div);

    // Keep only last 15 items in live feed
    while (feedContainer.children.length > 15) {
      feedContainer.removeChild(feedContainer.lastChild);
    }
  }

  function renderQuickTestButtons() {
    const container = document.getElementById('quick-test-chips');
    if (!container) return;

    container.innerHTML = '';
    const sampleStudents = state.students.slice(0, 6);

    sampleStudents.forEach((student) => {
      const btn = document.createElement('button');
      btn.className = 'test-chip-btn';
      btn.type = 'button';
      btn.innerHTML = `<span>Scan:</span> ${student.fullName} (${student.barcode})`;
      btn.onclick = () => {
        handleBarcodeScan(student.barcode);
      };
      container.appendChild(btn);
    });

    // Also add an invalid scan test button
    const invalidBtn = document.createElement('button');
    invalidBtn.className = 'test-chip-btn';
    invalidBtn.type = 'button';
    invalidBtn.style.color = '#dc2626';
    invalidBtn.innerHTML = `<span>Test:</span> Invalid Barcode (XYZ-999)`;
    invalidBtn.onclick = () => {
      handleBarcodeScan('XYZ-9999');
    };
    container.appendChild(invalidBtn);
  }

  // ==========================================================================
  // 6. GENERATE STUDENT ID CARDS WITH BARCODES (Module 3)
  // Print-Ready Layout, Code128 Barcode, PDF Download, Direct Print
  // ==========================================================================
  function initIdCardGenerator() {
    const studentSelect = document.getElementById('id-card-select-student');
    const nameInput = document.getElementById('card-input-name');
    const idInput = document.getElementById('card-input-id');
    const classInput = document.getElementById('card-input-class');
    const instInput = document.getElementById('card-input-institution');
    const photoInput = document.getElementById('card-input-photo');
    const photoClearBtn = document.getElementById('card-photo-clear');

    // Populate student select dropdown
    populateCardStudentDropdown();

    if (studentSelect) {
      studentSelect.addEventListener('change', () => {
        const selectedId = studentSelect.value;
        if (!selectedId) return;

        const student = state.students.find(s => s.id === selectedId);
        if (student) {
          nameInput.value = student.fullName || '';
          idInput.value = student.studentId || '';
          classInput.value = student.className || '';
          cardPhotoDataUrl = student.photo || '';
          updatePhotoPreview(cardPhotoDataUrl);
          updateIdCardPreview();
        }
      });
    }

    // Live update preview on form input
    [nameInput, idInput, classInput, instInput].forEach((inp) => {
      if (inp) {
        inp.addEventListener('input', () => {
          updateIdCardPreview();
        });
      }
    });

    let cardPhotoDataUrl = '';

    if (photoInput) {
      photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            cardPhotoDataUrl = event.target.result;
            updatePhotoPreview(cardPhotoDataUrl);
            updateIdCardPreview();
          };
          reader.readAsDataURL(file);
        }
      });
    }

    if (photoClearBtn) {
      photoClearBtn.addEventListener('click', () => {
        cardPhotoDataUrl = '';
        if (photoInput) photoInput.value = '';
        updatePhotoPreview('');
        updateIdCardPreview();
      });
    }

    function updatePhotoPreview(src) {
      const previewImg = document.getElementById('card-photo-preview-img');
      const placeholderIcon = document.getElementById('card-photo-placeholder-icon');
      if (previewImg && placeholderIcon) {
        if (src) {
          previewImg.src = src;
          previewImg.style.display = 'block';
          placeholderIcon.style.display = 'none';
        } else {
          previewImg.style.display = 'none';
          placeholderIcon.style.display = 'block';
        }
      }
    }

    // Default values if form is empty
    if (instInput && !instInput.value) {
      instInput.value = state.settings.institutionName;
    }
    if (nameInput && !nameInput.value && state.students.length > 0) {
      const first = state.students[0];
      nameInput.value = first.fullName;
      idInput.value = first.studentId;
      classInput.value = first.className;
      if (studentSelect) studentSelect.value = first.id;
    }

    updateIdCardPreview();
  }

  function populateCardStudentDropdown() {
    const studentSelect = document.getElementById('id-card-select-student');
    if (!studentSelect) return;

    studentSelect.innerHTML = '<option value="">-- Choose Existing Student or Fill Form Below --</option>';
    state.students.forEach((student) => {
      const opt = document.createElement('option');
      opt.value = student.id;
      opt.textContent = `${student.fullName} (${student.studentId} - ${student.className})`;
      studentSelect.appendChild(opt);
    });
  }

  function updateIdCardPreview() {
    const name = document.getElementById('card-input-name')?.value.trim() || 'Student Full Name';
    const id = document.getElementById('card-input-id')?.value.trim() || 'STU-1001';
    const className = document.getElementById('card-input-class')?.value.trim() || 'Grade 10-A';
    const instName = document.getElementById('card-input-institution')?.value.trim() || state.settings.institutionName;
    const photoImg = document.getElementById('card-photo-preview-img');

    // Update Text elements on preview card
    const previewInst = document.getElementById('preview-card-institution');
    const previewName = document.getElementById('preview-card-name');
    const previewId = document.getElementById('preview-card-id');
    const previewClass = document.getElementById('preview-card-class');
    const previewPhoto = document.getElementById('preview-card-photo');
    const barcodeText = document.getElementById('preview-card-barcode-text');

    if (previewInst) previewInst.textContent = instName;
    if (previewName) previewName.textContent = name;
    if (previewId) previewId.textContent = id;
    if (previewClass) previewClass.textContent = className;
    if (barcodeText) barcodeText.textContent = id;

    if (previewPhoto) {
      if (photoImg && photoImg.src && photoImg.style.display !== 'none') {
        previewPhoto.src = photoImg.src;
      } else {
        previewPhoto.src = generateDefaultAvatar(name);
      }
    }

    // Render Barcode via JsBarcode into preview SVG
    renderBarcodeOnCard(id);
  }

  function renderBarcodeOnCard(barcodeString) {
    const svgEl = document.getElementById('preview-barcode-svg');
    if (!svgEl || !window.JsBarcode) return;

    try {
      window.JsBarcode(svgEl, barcodeString, {
        format: 'CODE128',
        width: 1.6,
        height: 44,
        displayValue: false, // We display text nicely below it
        margin: 2,
        background: '#ffffff',
        lineColor: '#111827'
      });
    } catch (err) {
      console.warn('Barcode render error:', err);
    }
  }

  // Generate SVG/Canvas Default Avatar with initials
  function generateDefaultAvatar(name) {
    const initials = name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'ST';

    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 200, 200);
    grad.addColorStop(0, '#2563eb');
    grad.addColorStop(1, '#1e3a8a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 200, 200);

    // Initial letters
    ctx.font = 'bold 80px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, 100, 105);

    return canvas.toDataURL('image/png');
  }

  // Print ID Card using browser print dialog with targeted styles
  function printIdCard() {
    document.body.classList.add('printing-id-card');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-id-card');
    }, 500);
  }

  // Download ID Card as PDF
  async function downloadIdCardPDF() {
    const cardEl = document.getElementById('id-card-preview-element');
    const studentName = document.getElementById('card-input-name')?.value.trim() || 'Student';
    const studentId = document.getElementById('card-input-id')?.value.trim() || 'ID';

    if (!cardEl) return;
    showToast('Generating high-resolution ID Card PDF...', 'toast-info');

    try {
      if (!window.html2canvas || !window.jspdf) {
        throw new Error('PDF libraries are loading or unavailable');
      }

      // Render the ID Card to high-res canvas (scale 3 for ultra-crisp 300 DPI text & barcode)
      const canvas = await window.html2canvas(cardEl, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const { jsPDF } = window.jspdf;

      // Standard CR80 ID Card dimensions: 54mm x 85.6mm (portrait)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [54, 85.6]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, 54, 85.6, '', 'FAST');
      pdf.save(`ID-Card-${studentId}-${studentName.replace(/\s+/g, '_')}.pdf`);
      showToast('ID Card PDF downloaded successfully!', 'toast-success');
    } catch (err) {
      console.error('PDF export error:', err);
      // Fallback: trigger print
      alert('Unable to generate PDF directly in browser: ' + err.message + '. You can use the "Print ID Card" button and choose "Save as PDF"!');
    }
  }

  // Save student directly from ID card form if not already registered
  async function saveStudentFromCardForm() {
    const name = document.getElementById('card-input-name')?.value.trim();
    const id = document.getElementById('card-input-id')?.value.trim();
    const className = document.getElementById('card-input-class')?.value.trim();
    const photoImg = document.getElementById('card-photo-preview-img');
    const photo = (photoImg && photoImg.style.display !== 'none') ? photoImg.src : '';

    if (!name || !id || !className) {
      showToast('Please fill in Student Name, ID, and Class.', 'toast-warning');
      return;
    }

    const existingStudent = state.students.find(s => s.id === id);
    const newStudent = {
      id: id,
      studentId: id,
      fullName: name,
      className: className,
      barcode: id,
      photo: photo,
      createdAt: existingStudent ? existingStudent.createdAt : new Date().toISOString()
    };

    await saveStudentToDB(newStudent);

    const idx = state.students.findIndex(s => s.id === id);
    if (idx >= 0) state.students[idx] = newStudent;
    else state.students.push(newStudent);

    populateCardStudentDropdown();
    renderStudentTable();
    renderQuickTestButtons();
    updateTodayStats();
    showToast(`Student ${name} (${id}) saved to directory!`, 'toast-success');
  }

  // ==========================================================================
  // 7. STUDENT REGISTRATION (Module 4)
  // Form, Directory, Search, Unique ID Validation, Regenerate ID Card
  // ==========================================================================
  function initStudentRegistration() {
    const form = document.getElementById('student-reg-form');
    const photoInput = document.getElementById('reg-student-photo');
    const previewImg = document.getElementById('reg-photo-preview-img');
    const searchInput = document.getElementById('student-search-input');
    const idInput = document.getElementById('reg-student-id');
    const barcodeInput = document.getElementById('reg-student-barcode');

    // Auto-mirror Student ID to Barcode field if empty
    if (idInput && barcodeInput) {
      idInput.addEventListener('input', () => {
        barcodeInput.value = idInput.value.trim();
      });
    }

    let regPhotoDataUrl = '';

    if (photoInput) {
      photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            regPhotoDataUrl = event.target.result;
            if (previewImg) {
              previewImg.src = regPhotoDataUrl;
              previewImg.style.display = 'block';
            }
          };
          reader.readAsDataURL(file);
        }
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('reg-student-name').value.trim();
        const studentId = document.getElementById('reg-student-id').value.trim();
        const className = document.getElementById('reg-student-class').value.trim();
        const barcode = document.getElementById('reg-student-barcode').value.trim() || studentId;

        if (!name || !studentId || !className) {
          showToast('Name, Student ID, and Class are required.', 'toast-warning');
          return;
        }

        // Unique Student ID check
        const idExists = state.students.some(s => s.studentId.toLowerCase() === studentId.toLowerCase());
        if (idExists) {
          showToast(`Student ID "${studentId}" already exists! Please use a unique ID.`, 'toast-danger');
          return;
        }

        // Unique Barcode check
        const barcodeExists = state.students.some(s => s.barcode.toLowerCase() === barcode.toLowerCase());
        if (barcodeExists) {
          showToast(`Barcode "${barcode}" is already assigned to another student!`, 'toast-danger');
          return;
        }

        const newStudent = {
          id: studentId,
          studentId: studentId,
          fullName: name,
          className: className,
          barcode: barcode,
          photo: regPhotoDataUrl || window._capturedRegPhoto || '',
          createdAt: new Date().toISOString()
        };

        await saveStudentToDB(newStudent);
        state.students.push(newStudent);

        // Reset form
        form.reset();
        regPhotoDataUrl = '';
        window._capturedRegPhoto = '';
        if (previewImg) previewImg.style.display = 'none';

        renderStudentTable();
        populateCardStudentDropdown();
        renderQuickTestButtons();
        updateTodayStats();
        showToast(`Student "${name}" registered successfully!`, 'toast-success');
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        renderStudentTable(searchInput.value.trim());
      });
    }

    renderStudentTable();
  }

  function renderStudentTable(query = '') {
    const tbody = document.getElementById('student-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    const filtered = state.students.filter((student) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        student.fullName.toLowerCase().includes(q) ||
        student.studentId.toLowerCase().includes(q) ||
        student.className.toLowerCase().includes(q) ||
        (student.barcode && student.barcode.toLowerCase().includes(q))
      );
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
            No students found matching your search.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach((student, index) => {
      const tr = document.createElement('tr');
      const photoSrc = student.photo || generateDefaultAvatar(student.fullName);

      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <img src="${photoSrc}" alt="${student.fullName}" class="student-row-photo" />
            <span style="font-weight: 700;">${student.fullName}</span>
          </div>
        </td>
        <td><span class="barcode-badge">${student.studentId}</span></td>
        <td>${student.className}</td>
        <td>
          <span class="barcode-badge" style="background: #e0f2fe; color: #0369a1; border-color: #bae6fd;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="4" y1="9" x2="4" y2="15"></line>
              <line x1="8" y1="9" x2="8" y2="15"></line>
              <line x1="12" y1="9" x2="12" y2="15"></line>
              <line x1="16" y1="9" x2="16" y2="15"></line>
              <line x1="20" y1="9" x2="20" y2="15"></line>
            </svg>
            ${student.barcode}
          </span>
        </td>
        <td>
          <div class="action-btns">
            <button class="btn-icon-action" title="Generate & Print ID Card" data-action="card" data-id="${student.id}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="18" rx="2"></rect>
                <line x1="2" y1="8" x2="22" y2="8"></line>
                <circle cx="8" cy="14" r="2"></circle>
              </svg>
              ID Card
            </button>
            <button class="btn-icon-action" title="Scan Attendance Now" data-action="scan" data-code="${student.barcode}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Scan
            </button>
            <button class="btn-icon-action danger" title="Delete Student" data-action="delete" data-id="${student.id}" data-name="${student.fullName}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </td>
      `;

      tbody.appendChild(tr);
    });

    // Delegate row action clicks
    tbody.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.onclick = async (e) => {
        const action = btn.getAttribute('data-action');
        if (action === 'card') {
          const id = btn.getAttribute('data-id');
          switchToSection('view-generate-id');
          const studentSelect = document.getElementById('id-card-select-student');
          if (studentSelect) {
            studentSelect.value = id;
            studentSelect.dispatchEvent(new Event('change'));
          }
        } else if (action === 'scan') {
          const code = btn.getAttribute('data-code');
          switchToSection('view-live-monitor');
          handleBarcodeScan(code);
        } else if (action === 'delete') {
          const id = btn.getAttribute('data-id');
          const name = btn.getAttribute('data-name');
          if (confirm(`Are you sure you want to delete student "${name}" (${id})?`)) {
            await deleteStudentFromDB(id);
            state.students = state.students.filter(s => s.id !== id);
            renderStudentTable();
            populateCardStudentDropdown();
            renderQuickTestButtons();
            updateTodayStats();
            showToast(`Student ${name} deleted.`, 'toast-info');
          }
        }
      };
    });
  }

  // ==========================================================================
  // 8. ATTENDANCE RECORDS (Module 5)
  // Table, Date & Class Filters, PDF Report Export
  // ==========================================================================
  function initAttendanceRecords() {
    const filterDate = document.getElementById('att-filter-date');
    const filterClass = document.getElementById('att-filter-class');
    const btnToday = document.getElementById('att-btn-today');
    const btnAllDates = document.getElementById('att-btn-all-dates');
    const btnExportPDF = document.getElementById('att-btn-export-pdf');
    const btnPrintTable = document.getElementById('att-btn-print-table');
    const searchInput = document.getElementById('att-search-input');

    // Default to today's date
    if (filterDate) {
      filterDate.value = getTodayDateString();
      filterDate.addEventListener('change', renderAttendanceTable);
    }

    if (btnToday) {
      btnToday.addEventListener('click', () => {
        if (filterDate) {
          filterDate.value = getTodayDateString();
          renderAttendanceTable();
        }
      });
    }

    if (btnAllDates) {
      btnAllDates.addEventListener('click', () => {
        if (filterDate) {
          filterDate.value = '';
          renderAttendanceTable();
        }
      });
    }

    if (filterClass) {
      filterClass.addEventListener('change', renderAttendanceTable);
    }

    if (searchInput) {
      searchInput.addEventListener('input', renderAttendanceTable);
    }

    if (btnExportPDF) {
      btnExportPDF.addEventListener('click', exportAttendanceReportPDF);
    }

    if (btnPrintTable) {
      btnPrintTable.addEventListener('click', () => {
        document.body.classList.add('printing-attendance-report');
        window.print();
        setTimeout(() => {
          document.body.classList.remove('printing-attendance-report');
        }, 500);
      });
    }

    populateClassDropdown();
    renderAttendanceTable();
  }

  function populateClassDropdown() {
    const select = document.getElementById('att-filter-class');
    if (!select) return;

    const currentVal = select.value;
    const classes = Array.from(new Set(state.students.map(s => s.className).filter(Boolean))).sort();

    select.innerHTML = '<option value="">All Classes</option>';
    classes.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      select.appendChild(opt);
    });

    select.value = currentVal;
  }

  function getFilteredAttendance() {
    const filterDate = document.getElementById('att-filter-date')?.value || '';
    const filterClass = document.getElementById('att-filter-class')?.value || '';
    const search = document.getElementById('att-search-input')?.value.trim().toLowerCase() || '';

    return state.attendance.filter((rec) => {
      if (filterDate && rec.date !== filterDate) return false;
      if (filterClass && rec.className !== filterClass) return false;
      if (search) {
        return (
          (rec.studentName && rec.studentName.toLowerCase().includes(search)) ||
          (rec.studentId && rec.studentId.toLowerCase().includes(search)) ||
          (rec.className && rec.className.toLowerCase().includes(search))
        );
      }
      return true;
    });
  }

  function renderAttendanceTable() {
    const tbody = document.getElementById('attendance-table-body');
    const countBadge = document.getElementById('att-filtered-count');
    if (!tbody) return;

    tbody.innerHTML = '';
    const records = getFilteredAttendance();

    if (countBadge) {
      countBadge.textContent = `${records.length} record${records.length === 1 ? '' : 's'}`;
    }

    if (records.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            No attendance records found for the selected filter criteria.
          </td>
        </tr>
      `;
      return;
    }

    records.forEach((rec, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td><strong style="color: var(--text-main);">${rec.studentName}</strong></td>
        <td><span class="barcode-badge">${rec.studentId}</span></td>
        <td>${rec.className}</td>
        <td>${formatDisplayDate(rec.date)}</td>
        <td><strong>${rec.time}</strong></td>
        <td>
          <span class="badge-tag-sm tag-success" style="font-size: 0.8rem; padding: 0.25rem 0.65rem;">
            &bull; ${rec.status || 'Present'}
          </span>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Generate & Export Clean Tabular PDF Report
  async function exportAttendanceReportPDF() {
    const records = getFilteredAttendance();
    if (records.length === 0) {
      showToast('No attendance records to export.', 'toast-warning');
      return;
    }

    showToast('Generating Attendance PDF Report...', 'toast-info');

    try {
      if (!window.jspdf) {
        throw new Error('jsPDF library not ready');
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });

      const filterDate = document.getElementById('att-filter-date')?.value || 'All Dates';
      const filterClass = document.getElementById('att-filter-class')?.value || 'All Classes';
      const institution = state.settings.institutionName;

      // Header Branding
      doc.setFillColor(30, 58, 138); // Navy blue
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 65, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text(institution, 40, 32);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(219, 234, 254);
      doc.text('OFFICIAL STUDENT ATTENDANCE REPORT', 40, 48);

      // Report Summary Meta Bar
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Date Filter: ${filterDate}   |   Class Filter: ${filterClass}   |   Total Present: ${records.length}`, 40, 85);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 40, 98);

      // Table Header
      let startY = 115;
      doc.setFillColor(241, 245, 249);
      doc.rect(40, startY, 515, 24, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);

      doc.text('#', 50, startY + 16);
      doc.text('Student Name', 80, startY + 16);
      doc.text('Student ID', 220, startY + 16);
      doc.text('Class', 310, startY + 16);
      doc.text('Date', 380, startY + 16);
      doc.text('Time', 450, startY + 16);
      doc.text('Status', 510, startY + 16);

      // Table Rows
      let currentY = startY + 24;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);

      records.forEach((rec, i) => {
        // Page break if near bottom
        if (currentY > doc.internal.pageSize.getHeight() - 40) {
          doc.addPage();
          currentY = 40;
          // Re-print table header
          doc.setFillColor(241, 245, 249);
          doc.rect(40, currentY, 515, 24, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 41, 59);
          doc.text('#', 50, currentY + 16);
          doc.text('Student Name', 80, currentY + 16);
          doc.text('Student ID', 220, currentY + 16);
          doc.text('Class', 310, currentY + 16);
          doc.text('Date', 380, currentY + 16);
          doc.text('Time', 450, currentY + 16);
          doc.text('Status', 510, currentY + 16);
          currentY += 24;
          doc.setFont('helvetica', 'normal');
        }

        // Row background alternating
        if (i % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(40, currentY, 515, 20, 'F');
        }

        doc.setTextColor(15, 23, 42);
        doc.text(String(i + 1), 50, currentY + 14);
        doc.text(rec.studentName.substring(0, 24), 80, currentY + 14);
        doc.text(rec.studentId, 220, currentY + 14);
        doc.text(rec.className, 310, currentY + 14);
        doc.text(rec.date, 380, currentY + 14);
        doc.text(rec.time, 450, currentY + 14);

        // Status pill
        doc.setTextColor(5, 150, 105);
        doc.text('Present', 510, currentY + 14);

        // Underline
        doc.setDrawColor(226, 232, 240);
        doc.line(40, currentY + 20, 555, currentY + 20);

        currentY += 20;
      });

      doc.save(`Attendance-Report-${filterDate.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
      showToast('Attendance report exported to PDF!', 'toast-success');
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Could not export PDF directly: ' + err.message + '. You can use the "Print Table" button to print or save as PDF.');
    }
  }

  // ==========================================================================
  // 9. UI NAVIGATION, TOASTS, BACKUP & RESTORE
  // ==========================================================================
  function initNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn[data-target]');
    navButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        switchToSection(target);
      });
    });

    // Fullscreen Toggle
    const fullscreenBtn = document.getElementById('btn-toggle-fullscreen');
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(err => console.log(err));
        } else {
          document.exitFullscreen().catch(err => console.log(err));
        }
      });
    }

    // Monitor Theme Toggle (Dark/Light)
    const themeBtn = document.getElementById('btn-toggle-theme');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('monitor-dark');
        const isDark = document.body.classList.contains('monitor-dark');
        saveSettingToDB('theme', isDark ? 'dark' : 'light');
      });
    }

    // Audio Mute/Unmute Toggle
    const soundBtn = document.getElementById('btn-toggle-sound');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        state.settings.soundEnabled = !state.settings.soundEnabled;
        saveSettingToDB('soundEnabled', state.settings.soundEnabled);
        updateSoundButtonUI();
        if (state.settings.soundEnabled) {
          playSuccessChime();
          showToast('Scanner Audio Chimes: Enabled', 'toast-success');
        } else {
          showToast('Scanner Audio Chimes: Muted', 'toast-warning');
        }
      });
    }

    // Quick Institution Name Edit
    const instTag = document.getElementById('header-institution-tag');
    if (instTag) {
      instTag.addEventListener('click', () => {
        const newName = prompt('Enter Institution / School Name:', state.settings.institutionName);
        if (newName && newName.trim()) {
          state.settings.institutionName = newName.trim();
          saveSettingToDB('institutionName', state.settings.institutionName);
          updateInstitutionUI();
          showToast('Institution name updated!', 'toast-success');
        }
      });
    }

    // ID Card Action buttons
    const btnPrintCard = document.getElementById('btn-print-id-card');
    if (btnPrintCard) btnPrintCard.addEventListener('click', printIdCard);

    const btnDownloadPDF = document.getElementById('btn-download-id-pdf');
    if (btnDownloadPDF) btnDownloadPDF.addEventListener('click', downloadIdCardPDF);

    const btnSaveCardStudent = document.getElementById('btn-save-card-student');
    if (btnSaveCardStudent) btnSaveCardStudent.addEventListener('click', saveStudentFromCardForm);
  }

  function switchToSection(targetSectionId) {
    state.activeSection = targetSectionId;

    // Update active nav button
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-target') === targetSectionId);
    });

    // Update section visibility
    document.querySelectorAll('.view-section').forEach((sec) => {
      sec.classList.toggle('active', sec.id === targetSectionId);
    });

    // Refresh dynamic content when entering sections
    if (targetSectionId === 'view-live-monitor') {
      const input = document.getElementById('quick-scanner-input');
      if (input) input.focus();
      renderQuickTestButtons();
      updateTodayStats();
    } else if (targetSectionId === 'view-generate-id') {
      populateCardStudentDropdown();
      updateIdCardPreview();
    } else if (targetSectionId === 'view-student-registration') {
      renderStudentTable();
    } else if (targetSectionId === 'view-attendance-records') {
      populateClassDropdown();
      renderAttendanceTable();
    }
  }

  function updateSoundButtonUI() {
    const soundBtn = document.getElementById('btn-toggle-sound');
    if (!soundBtn) return;
    if (state.settings.soundEnabled) {
      soundBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>
        <span>Sound On</span>
      `;
      soundBtn.classList.remove('btn-secondary');
    } else {
      soundBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="1" y1="1" x2="23" y2="23"></line>
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        </svg>
        <span>Muted</span>
      `;
      soundBtn.classList.add('btn-secondary');
    }
  }

  function updateInstitutionUI() {
    const tag = document.getElementById('header-institution-tag');
    if (tag) tag.textContent = state.settings.institutionName;
    const cardInstInput = document.getElementById('card-input-institution');
    if (cardInstInput) cardInstInput.value = state.settings.institutionName;
    updateIdCardPreview();
  }

  function showToast(message, type = 'toast-info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s, transform 0.3s';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // ==========================================================================
  // 10. DEVICE CAMERA BARCODE SCANNER (Live Camera / Webcam Scanning)
  // ==========================================================================
  async function initCameraScanner() {
    const toggleBtn = document.getElementById('btn-toggle-camera');
    const deviceSelect = document.getElementById('camera-device-select');
    const autoStartToggle = document.getElementById('camera-auto-start-toggle');

    if (autoStartToggle) {
      autoStartToggle.checked = !!state.settings.autoStartCamera;
      autoStartToggle.addEventListener('change', () => {
        state.settings.autoStartCamera = autoStartToggle.checked;
        saveSettingToDB('autoStartCamera', autoStartToggle.checked);
      });
    }

    if (deviceSelect) {
      deviceSelect.addEventListener('change', () => {
        state.selectedCameraId = deviceSelect.value || null;
        if (state.isCameraScanning) {
          stopCameraScanner().then(() => startCameraScanner());
        }
      });
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        if (state.isCameraScanning) {
          stopCameraScanner();
        } else {
          startCameraScanner();
        }
      });
    }

    // Populate camera devices dropdown
    await loadCameraDevices();

    // Auto-start camera if setting enabled
    if (state.settings.autoStartCamera) {
      setTimeout(() => {
        startCameraScanner();
      }, 600);
    }
  }

  async function loadCameraDevices() {
    const select = document.getElementById('camera-device-select');
    if (!select) return;

    try {
      if (window.Html5Qrcode && Html5Qrcode.getCameras) {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          select.innerHTML = '';
          devices.forEach((device, i) => {
            const opt = document.createElement('option');
            opt.value = device.id;
            opt.textContent = device.label || `Camera ${i + 1}`;
            select.appendChild(opt);
          });
          state.selectedCameraId = devices[0].id;
        } else {
          select.innerHTML = '<option value="">Default Camera</option>';
        }
      }
    } catch (e) {
      console.warn('Could not enumerate cameras:', e);
      select.innerHTML = '<option value="">Default Camera</option>';
    }
  }

  async function startCameraScanner() {
    if (state.isCameraScanning) return;

    const readerEl = document.getElementById('camera-reader');
    const placeholder = document.getElementById('camera-placeholder');
    const laserBeam = document.getElementById('camera-laser-beam');
    const statusBadge = document.getElementById('camera-status-badge');
    const statusText = document.getElementById('camera-status-text');
    const toggleBtn = document.getElementById('btn-toggle-camera');
    const btnText = document.getElementById('btn-camera-text');

    if (!window.Html5Qrcode) {
      showToast('Camera barcode scanner library is loading. Please wait a moment.', 'toast-warning');
      return;
    }

    try {
      if (placeholder) placeholder.style.display = 'none';
      if (readerEl) readerEl.style.display = 'block';

      if (!state.html5QrCode) {
        state.html5QrCode = new Html5Qrcode("camera-reader");
      }

      const cameraConfig = state.selectedCameraId
        ? { deviceId: { exact: state.selectedCameraId } }
        : { facingMode: "environment" };

      const scanConfig = {
        fps: 15,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          return {
            width: Math.floor(viewfinderWidth * 0.85),
            height: Math.floor(minEdge * 0.55)
          };
        },
        aspectRatio: 1.333333,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE
        ]
      };

      await state.html5QrCode.start(
        cameraConfig,
        scanConfig,
        (decodedText) => {
          onCameraBarcodeDetected(decodedText);
        },
        () => {}
      );

      state.isCameraScanning = true;
      if (laserBeam) laserBeam.style.display = 'block';
      if (statusBadge) statusBadge.classList.add('active');
      if (statusText) statusText.textContent = 'Camera Active';
      if (toggleBtn) {
        toggleBtn.classList.remove('btn-primary');
        toggleBtn.classList.add('btn-secondary');
      }
      if (btnText) btnText.textContent = 'Stop Camera';

      showToast('Camera scanner started. Ready for barcode scanning!', 'toast-success');
    } catch (err) {
      console.error('Camera start error:', err);
      if (placeholder) placeholder.style.display = 'flex';
      if (readerEl) readerEl.style.display = 'none';
      if (laserBeam) laserBeam.style.display = 'none';
      if (statusBadge) statusBadge.classList.remove('active');
      if (statusText) statusText.textContent = 'Camera Off';
      showToast('Camera access error: ' + (err.message || 'Permission denied or camera busy.'), 'toast-danger');
    }
  }

  async function stopCameraScanner() {
    if (!state.isCameraScanning || !state.html5QrCode) return;

    const readerEl = document.getElementById('camera-reader');
    const placeholder = document.getElementById('camera-placeholder');
    const laserBeam = document.getElementById('camera-laser-beam');
    const statusBadge = document.getElementById('camera-status-badge');
    const statusText = document.getElementById('camera-status-text');
    const toggleBtn = document.getElementById('btn-toggle-camera');
    const btnText = document.getElementById('btn-camera-text');

    try {
      await state.html5QrCode.stop();
      state.isCameraScanning = false;
    } catch (err) {
      console.warn('Camera stop error:', err);
      state.isCameraScanning = false;
    }

    if (readerEl) readerEl.style.display = 'none';
    if (placeholder) placeholder.style.display = 'flex';
    if (laserBeam) laserBeam.style.display = 'none';
    if (statusBadge) statusBadge.classList.remove('active');
    if (statusText) statusText.textContent = 'Camera Off';
    if (toggleBtn) {
      toggleBtn.classList.add('btn-primary');
      toggleBtn.classList.remove('btn-secondary');
    }
    if (btnText) btnText.textContent = 'Start Camera';
  }

  function onCameraBarcodeDetected(rawCode) {
    const code = rawCode ? rawCode.trim() : '';
    if (!code) return;

    const now = Date.now();
    // Debounce to prevent rapid duplicate trigger while card is in front of camera lens
    if (code === state.lastCameraScannedCode && now - state.lastCameraScanTime < 3500) {
      return;
    }
    if (now - state.lastCameraScanTime < 1200) {
      return;
    }

    state.lastCameraScannedCode = code;
    state.lastCameraScanTime = now;

    // Process attendance exactly like a physical USB scanner
    handleBarcodeScan(code);
  }

  // ==========================================================================
  // 11. WEBCAM PHOTO SNAPSHOT MODAL (Snap Student Photo with Device Camera)
  // ==========================================================================
  function initWebcamSnapshot() {
    const btnCardSnap = document.getElementById('btn-card-snap-photo');
    const btnRegSnap = document.getElementById('btn-reg-snap-photo');
    const modal = document.getElementById('webcam-photo-modal');
    const btnClose = document.getElementById('btn-close-webcam-modal');
    const btnCancel = document.getElementById('btn-cancel-snapshot');
    const btnCapture = document.getElementById('btn-capture-snapshot');

    if (btnCardSnap) {
      btnCardSnap.addEventListener('click', () => openWebcamSnapshotModal('card'));
    }

    if (btnRegSnap) {
      btnRegSnap.addEventListener('click', () => openWebcamSnapshotModal('reg'));
    }

    if (btnClose) btnClose.addEventListener('click', closeWebcamSnapshotModal);
    if (btnCancel) btnCancel.addEventListener('click', closeWebcamSnapshotModal);
    if (btnCapture) btnCapture.addEventListener('click', captureWebcamSnapshot);
  }

  async function openWebcamSnapshotModal(target) {
    state.activeSnapshotTarget = target;
    const modal = document.getElementById('webcam-photo-modal');
    const video = document.getElementById('snapshot-webcam-video');

    if (!modal || !video) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });
      state.webcamMediaStream = stream;
      video.srcObject = stream;
      modal.classList.add('active');
    } catch (err) {
      console.error('Webcam snapshot error:', err);
      showToast('Camera access denied or unavailable: ' + err.message, 'toast-danger');
    }
  }

  function closeWebcamSnapshotModal() {
    const modal = document.getElementById('webcam-photo-modal');
    const video = document.getElementById('snapshot-webcam-video');

    if (state.webcamMediaStream) {
      state.webcamMediaStream.getTracks().forEach(track => track.stop());
      state.webcamMediaStream = null;
    }

    if (video) video.srcObject = null;
    if (modal) modal.classList.remove('active');
  }

  function captureWebcamSnapshot() {
    const video = document.getElementById('snapshot-webcam-video');
    const canvas = document.getElementById('snapshot-canvas');
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    if (state.activeSnapshotTarget === 'card') {
      const previewImg = document.getElementById('card-photo-preview-img');
      const placeholderIcon = document.getElementById('card-photo-placeholder-icon');
      if (previewImg && placeholderIcon) {
        previewImg.src = dataUrl;
        previewImg.style.display = 'block';
        placeholderIcon.style.display = 'none';
      }
      updateIdCardPreview();
    } else if (state.activeSnapshotTarget === 'reg') {
      const regPreview = document.getElementById('reg-photo-preview-img');
      if (regPreview) {
        regPreview.src = dataUrl;
        regPreview.style.display = 'block';
      }
      window._capturedRegPhoto = dataUrl;
    }

    closeWebcamSnapshotModal();
    showToast('Student photo captured from camera!', 'toast-success');
  }

  // ==========================================================================
  // 12. SYSTEM STARTUP / INITIALIZATION
  // ==========================================================================
  window.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize IndexedDB & Seed Data
    await initDatabase();

    // 2. Setup Real-time Clock
    updateLiveClock();
    setInterval(updateLiveClock, 1000);

    // 3. Setup Navigation & Actions
    initNavigation();

    // 4. Setup Audio UI & Theme
    if (state.settings.theme === 'dark') {
      document.body.classList.add('monitor-dark');
    }
    updateSoundButtonUI();
    updateInstitutionUI();

    // 5. Initialize Barcode Scanner Engine (USB Keyboard Emulation)
    initBarcodeScanner();

    // 6. Initialize Device Camera Barcode Scanner & Webcam Snapshots
    await initCameraScanner();
    initWebcamSnapshot();

    // 7. Initialize Module Components
    renderLiveCardIdle();
    renderQuickTestButtons();
    updateTodayStats();
    initIdCardGenerator();
    initStudentRegistration();
    initAttendanceRecords();

    // Switch to Live Monitor view as default
    switchToSection('view-live-monitor');

    console.log('Student Barcode Attendance Management System initialized successfully.');
  });
})();
