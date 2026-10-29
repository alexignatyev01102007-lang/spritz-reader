// Алгоритм ORP
function getORPIndex(word) {
  const len = word.length;
  if (len <= 5) return Math.floor(len / 2);
  if (len <= 9) return Math.floor(len / 2) - 1;
  return Math.floor(len / 2) - 2;
}

// Настройки шрифтов
const FONTS = {
  monospace: [
    { name: 'Системный моно', family: "'SF Mono', 'Consolas', 'Monaco', monospace" },
    { name: 'JetBrains Mono', family: "'JetBrains Mono', monospace" },
    { name: 'Fira Code', family: "'Fira Code', monospace" },
  ],
  sans: [
    { name: 'Inter / System', family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
    { name: 'Roboto', family: "'Roboto', sans-serif" },
  ],
  serif: [
    { name: 'Georgia', family: "'Georgia', 'Times New Roman', serif" },
  ]
};

const DEFAULTS = {
  wpm: 300,
  fontSize: 52,
  fontFamily: FONTS.monospace[0].family,
  fontName: FONTS.monospace[0].name
};

let isReading = false;
let intervalId = null;
let currentWords = [];
let currentIndex = 0;
let wpm = DEFAULTS.wpm;
let fontSize = DEFAULTS.fontSize;
let currentFont = { family: DEFAULTS.fontFamily, name: DEFAULTS.fontName };
let isFinished = false;

// Загрузка настроек
function loadSettings() {
  const savedWpm = localStorage.getItem('spritz_wpm');
  const savedFontSize = localStorage.getItem('spritz_fontSize');
  const savedFontFamily = localStorage.getItem('spritz_fontFamily');
  const savedFontName = localStorage.getItem('spritz_fontName');
  
  if (savedWpm) wpm = parseInt(savedWpm);
  if (savedFontSize) fontSize = parseInt(savedFontSize);
  if (savedFontFamily && savedFontName) {
    currentFont = { family: savedFontFamily, name: savedFontName };
  }
}

// Сохранение настроек
function saveSettings() {
  localStorage.setItem('spritz_wpm', wpm);
  localStorage.setItem('spritz_fontSize', fontSize);
  localStorage.setItem('spritz_fontFamily', currentFont.family);
  localStorage.setItem('spritz_fontName', currentFont.name);
}

// Сохранение прогресса
function saveProgress() {
  if (window.currentFileName && window.currentFileSize) {
    const progress = {
      fileName: window.currentFileName,
      fileSize: window.currentFileSize,
      wordIndex: currentIndex,
      totalWords: currentWords.length,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('spritz_progress', JSON.stringify(progress));
    
    // Обновляем прогресс в списке недавних файлов
    if (window.updateFileProgress) {
      window.updateFileProgress(
        window.currentFileName,
        window.currentFileSize,
        currentIndex,
        currentWords.length
      );
    }
  }
}

// Загрузка прогресса
function loadProgress(fileName, fileSize) {
  const saved = localStorage.getItem('spritz_progress');
  if (!saved) return null;
  
  const progress = JSON.parse(saved);
  if (progress.fileName === fileName && progress.fileSize === fileSize) {
    return progress.wordIndex;
  }
  return null;
}

// Поиск начала предложения назад (по знакам . ! ?)
function findSentenceStart(wordIndex) {
  for (let i = wordIndex - 1; i >= 0; i--) {
    const word = currentWords[i];
    if (word && /[.!?]$/.test(word)) {
      return Math.min(i + 1, currentWords.length - 1);
    }
  }
  return 0;
}

// Поиск начала следующего предложения вперёд
function findNextSentenceStart(wordIndex) {
  for (let i = wordIndex; i < currentWords.length; i++) {
    const word = currentWords[i];
    if (word && /[.!?]$/.test(word)) {
      return Math.min(i + 1, currentWords.length - 1);
    }
  }
  return currentWords.length - 1;
}

// Сброс прогресса
function clearProgress() {
  localStorage.removeItem('spritz_progress');
}

// Обновление отображения слова и прогресса
function updateDisplay() {
  if (currentIndex >= currentWords.length) {
    finishReading();
    return;
  }

  const word = currentWords[currentIndex];
  const orpIndex = getORPIndex(word);

  const before = word.slice(0, orpIndex);
  const orpChar = word[orpIndex];
  const after = word.slice(orpIndex + 1);

  document.getElementById('spritz-word').innerHTML =
    `${before}<span class="orp">${orpChar}</span>${after}`;

  document.getElementById('spritz-progress').innerText =
    `${currentIndex + 1} / ${currentWords.length}`;
}

// Запуск чтения
function startReading(text, fileName = null, fileSize = null) {
  if (isReading) {
    stopSpritz();
  }

  currentWords = text.replace(/\s+/g, ' ').trim().split(' ');
  currentIndex = 0;
  isFinished = false;

  loadSettings();

  if (fileName && fileSize) {
    const savedProgress = loadProgress(fileName, fileSize);
    if (savedProgress !== null) {
      currentIndex = findSentenceStart(savedProgress);
      console.log(`Восстановлен прогресс: слово ${currentIndex} из ${currentWords.length}`);
    }
  }

  generateFontDropdown();

  document.getElementById('speed-label').innerText = wpm;
  document.getElementById('size-label').innerText = fontSize;
  document.getElementById('font-name').innerText = currentFont.name;
  document.getElementById('spritz-word').style.fontSize = fontSize + 'px';
  document.getElementById('spritz-word').style.fontFamily = currentFont.family;
  document.getElementById('spritz-progress').style.color = '#A0A0A0';

  document.getElementById('spritz-pause').style.display = 'inline-flex';
  document.getElementById('spritz-pause').innerText = 'Пауза';
  document.getElementById('spritz-restart').style.display = 'none';

  isReading = true;

  updateDisplay();
  
  const delay = 60000 / wpm;
  intervalId = setInterval(showNextWord, delay);

  if (!window.spritzHandlersAttached) {
    attachHandlers();
    window.spritzHandlersAttached = true;
  }

  window.currentFileName = fileName;
  window.currentFileSize = fileSize;
}

function generateFontDropdown() {
  const modalList = document.getElementById('font-modal-list');
  let html = '';
  
  for (const [category, fonts] of Object.entries(FONTS)) {
    const categoryName = category === 'monospace' ? 'Моноширинные' : 
                         category === 'sans' ? 'Без засечек' : 'С засечками';
    html += `<div class="font-modal-category">${categoryName}</div>`;
    
    fonts.forEach((font) => {
      const isActive = (font.family === currentFont.family) ? 'active' : '';
      const check = (font.family === currentFont.family) ? '✓' : '';
      html += `
        <div class="font-modal-option ${isActive}" data-family="${font.family}" data-name="${font.name}">
          <span style="font-family: ${font.family}">${font.name}</span>
          <span class="check">${check}</span>
        </div>
      `;
    });
  }
  
  modalList.innerHTML = html;
}

function attachHandlers() {
  // Скорость
  document.getElementById('speed-dec').onclick = () => {
    if (wpm > 50) {
      wpm = Math.max(50, wpm - 25);
      document.getElementById('speed-label').innerText = wpm;
      saveSettings();
      restartInterval();
    }
  };

  document.getElementById('speed-inc').onclick = () => {
    if (wpm < 1000) {
      wpm = Math.min(1000, wpm + 25);
      document.getElementById('speed-label').innerText = wpm;
      saveSettings();
      restartInterval();
    }
  };

  // Размер шрифта
  document.getElementById('size-dec').onclick = () => {
    if (fontSize > 20) {
      fontSize = Math.max(20, fontSize - 4);
      document.getElementById('size-label').innerText = fontSize;
      document.getElementById('spritz-word').style.fontSize = fontSize + 'px';
      saveSettings();
    }
  };

  document.getElementById('size-inc').onclick = () => {
    if (fontSize < 100) {
      fontSize = Math.min(100, fontSize + 4);
      document.getElementById('size-label').innerText = fontSize;
      document.getElementById('spritz-word').style.fontSize = fontSize + 'px';
      saveSettings();
    }
  };

  // Выбор шрифта
  document.getElementById('font-btn').onclick = () => {
    generateFontDropdown();
    document.getElementById('font-modal').classList.add('active');
  };

  document.getElementById('font-modal-close').onclick = () => {
    document.getElementById('font-modal').classList.remove('active');
  };

  document.getElementById('font-modal').onclick = (e) => {
    if (e.target.id === 'font-modal') {
      document.getElementById('font-modal').classList.remove('active');
    }
  };

  document.getElementById('font-modal-list').onclick = (e) => {
    const option = e.target.closest('.font-modal-option');
    if (option) {
      const family = option.dataset.family;
      const name = option.dataset.name;
      
      currentFont = { family, name };
      document.getElementById('spritz-word').style.fontFamily = family;
      document.getElementById('font-name').innerText = name;
      saveSettings();
      
      document.getElementById('font-modal').classList.remove('active');
    }
  };

  // Навигация
  document.getElementById('nav-prev-word').onclick = () => {
    if (currentIndex > 0) {
      currentIndex = Math.max(0, currentIndex - 1);
      updateDisplay();
      saveProgress();
      if (intervalId) {
        restartInterval();
      }
    }
  };

  document.getElementById('nav-prev-sentence').onclick = () => {
    if (currentIndex > 0) {
      currentIndex = findSentenceStart(currentIndex);
      updateDisplay();
      saveProgress();
      if (intervalId) {
        restartInterval();
      }
    }
  };

  document.getElementById('nav-next-word').onclick = () => {
    if (currentIndex < currentWords.length - 1) {
      currentIndex = Math.min(currentWords.length - 1, currentIndex + 1);
      updateDisplay();
      saveProgress();
      if (intervalId) {
        restartInterval();
      }
    }
  };

  document.getElementById('nav-next-sentence').onclick = () => {
    if (currentIndex < currentWords.length - 1) {
      currentIndex = findNextSentenceStart(currentIndex);
      updateDisplay();
      saveProgress();
      if (intervalId) {
        restartInterval();
      }
    }
  };

  // Пауза
  document.getElementById('spritz-pause').onclick = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      document.getElementById('spritz-pause').innerText = "Продолжить";
      saveProgress();
    } else {
      const delay = 60000 / wpm;
      intervalId = setInterval(showNextWord, delay);
      document.getElementById('spritz-pause').innerText = "Пауза";
    }
  };

  // Сначала
  document.getElementById('spritz-restart').onclick = () => {
    clearProgress();
    restartReading();
  };

  // Стоп
  document.getElementById('spritz-stop').onclick = () => {
    saveProgress();
    stopSpritz();
    showScreen('main-screen');
  };

  // В библиотеку
  document.getElementById('back-btn').onclick = () => {
    saveProgress();
    stopSpritz();
    showScreen('main-screen');
  };

  // Полный экран
  document.getElementById('fullscreen-btn').onclick = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.log('Ошибка полного экрана:', err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Блокировка поворота - работает всегда, не только в полноэкранном режиме
  let orientationLocked = false;
  document.getElementById('orientation-btn').onclick = async () => {
    if (!orientationLocked) {
      if (screen.orientation && screen.orientation.lock) {
        try {
          // Определяем текущую ориентацию
          const isLandscape = window.innerWidth > window.innerHeight;
          const lockType = isLandscape ? 'landscape' : 'portrait';
          
          await screen.orientation.lock(lockType);
          orientationLocked = true;
          document.getElementById('orientation-btn').innerText = '';
        } catch (err) {
          console.log('Блокировка не поддерживается:', err);
          // Пробуем альтернативный метод через CSS
          document.body.style.setProperty('--orientation-lock', 'enabled');
          orientationLocked = true;
          document.getElementById('orientation-btn').innerText = '🔒';
        }
      } else {
        // Fallback для браузеров без поддержки Screen Orientation API
        document.body.style.setProperty('--orientation-lock', 'enabled');
        orientationLocked = true;
        document.getElementById('orientation-btn').innerText = '🔒';
      }
    } else {
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
      }
      document.body.style.removeProperty('--orientation-lock');
      orientationLocked = false;
      document.getElementById('orientation-btn').innerText = '🔓';
    }
  };

  // Автосохранение прогресса каждые 5 секунд
  setInterval(() => {
    if (isReading && intervalId) {
      saveProgress();
    }
  }, 5000);
}

function showNextWord() {
  if (currentIndex >= currentWords.length) {
    finishReading();
    return;
  }

  updateDisplay();
  currentIndex++;
}

function finishReading() {
  clearInterval(intervalId);
  intervalId = null;
  isFinished = true;
  
  document.getElementById('spritz-pause').style.display = 'none';
  document.getElementById('spritz-restart').style.display = 'inline-flex';
  document.getElementById('spritz-progress').innerText = 
    `${currentWords.length} / ${currentWords.length} ✓`;
  document.getElementById('spritz-progress').style.color = '#6BCB77';
}

function restartReading() {
  currentIndex = 0;
  isFinished = false;
  document.getElementById('spritz-pause').style.display = 'inline-flex';
  document.getElementById('spritz-pause').innerText = 'Пауза';
  document.getElementById('spritz-restart').style.display = 'none';
  document.getElementById('spritz-progress').style.color = '#A0A0A0';
  
  updateDisplay();
  const delay = 60000 / wpm;
  intervalId = setInterval(showNextWord, delay);
}

function restartInterval() {
  if (intervalId) {
    clearInterval(intervalId);
    const delay = 60000 / wpm;
    intervalId = setInterval(showNextWord, delay);
  }
}

function stopSpritz() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  isReading = false;
  isFinished = false;
}
