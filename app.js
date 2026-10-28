// Переключение экранов
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

// Когда страница загрузилась
document.addEventListener('DOMContentLoaded', () => {
  const selectButton = document.getElementById('select-file');
  const fileInput = document.getElementById('file-input');
  const recentList = document.getElementById('recent-list');
  
  // Клик по кнопке "Выбрать файл"
  selectButton.addEventListener('click', () => {
    fileInput.click();
  });
  
  // Когда пользователь выбрал файл
  fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        // Читаем файл
        const text = await parseFile(file);
        
        // Сохраняем в список недавних
        saveRecentFile(file);
        
        // Запускаем читалку (передаем имя и размер файла для прогресса)
        startReading(text, file.name, file.size);
        
        // Переключаем на экран чтения
        showScreen('reader-screen');
      } catch (error) {
        alert('Ошибка чтения файла: ' + error.message);
      } finally {
        // ВАЖНО: сбрасываем значение, чтобы можно было выбрать тот же файл снова
        fileInput.value = '';
      }
    }
  });
  
  // Сохранение в список недавних
  function saveRecentFile(file) {
    let recent = JSON.parse(localStorage.getItem('recentFiles') || '[]');
    
    // Проверяем, нет ли уже такого файла (по имени и размеру)
    const exists = recent.some(f => f.name === file.name && f.size === file.size);
    
    if (!exists) {
      recent.unshift({
        name: file.name,
        size: file.size,
        date: new Date().toISOString()
      });
    } else {
      // Перемещаем существующий в начало
      recent = recent.filter(f => !(f.name === file.name && f.size === file.size));
      recent.unshift({
        name: file.name,
        size: file.size,
        date: new Date().toISOString()
      });
    }
    
    recent = recent.slice(0, 20);
    localStorage.setItem('recentFiles', JSON.stringify(recent));
  }
  
  // Показываем список недавних файлов
  function showRecentFiles() {
    const recent = JSON.parse(localStorage.getItem('recentFiles') || '[]');
    
    if (recent.length === 0) {
      recentList.innerHTML = '<p style="color: #666;">Пока нет недавних книг</p>';
      return;
    }
    
    recentList.innerHTML = recent.map(file => `
      <div class="recent-item" data-name="${file.name}" data-size="${file.size}">
        <div class="name">${file.name}</div>
        <div class="meta">${formatSize(file.size)} • ${formatDate(file.date)}</div>
      </div>
    `).join('');
    
    // Клик по недавнему файлу — открываем диалог выбора
    document.querySelectorAll('.recent-item').forEach(item => {
      item.addEventListener('click', () => {
        // Подсказываем пользователю выбрать тот же файл
        const fileName = item.dataset.name;
        const fileSize = parseInt(item.dataset.size);
        
        // Открываем диалог выбора файла
        fileInput.accept = getAcceptForFile(fileName);
        fileInput.click();
        
        // После выбора проверяем, что выбран правильный файл
        fileInput.onchange = async (event) => {
          const selectedFile = event.target.files[0];
          if (selectedFile && selectedFile.name === fileName && selectedFile.size === fileSize) {
            try {
              const text = await parseFile(selectedFile);
              startReading(text, selectedFile.name, selectedFile.size);
              showScreen('reader-screen');
            } catch (error) {
              alert('Ошибка чтения файла: ' + error.message);
            }
          } else if (selectedFile) {
            alert(`Пожалуйста, выберите файл "${fileName}"`);
          }
          fileInput.value = '';
          fileInput.onchange = null;
        };
      });
    });
  }
  
  // Определяем accept по расширению файла
  function getAcceptForFile(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    if (ext === 'txt') return '.txt';
    if (ext === 'epub') return '.epub';
    if (ext === 'fb2') return '.fb2';
    if (ext === 'html' || ext === 'htm') return '.html,.htm';
    return '.txt,.html,.htm,.epub,.fb2';
  }
  
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
  }
  
  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
  }
  
  showRecentFiles();
});