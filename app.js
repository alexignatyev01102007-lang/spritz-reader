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
        const text = await parseFile(file);
        saveRecentFile(file);
        startReading(text, file.name, file.size);
        showScreen('reader-screen');
      } catch (error) {
        alert('Ошибка чтения файла: ' + error.message);
      } finally {
        fileInput.value = '';
      }
    }
  });
  
  // Сохранение в список недавних
  function saveRecentFile(file) {
    let recent = JSON.parse(localStorage.getItem('recentFiles') || '[]');
    
    const exists = recent.some(f => f.name === file.name && f.size === file.size);
    
    if (!exists) {
      recent.unshift({
        name: file.name,
        size: file.size,
        date: new Date().toISOString()
      });
    } else {
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
    
    document.querySelectorAll('.recent-item').forEach(item => {
      item.addEventListener('click', () => {
        const fileName = item.dataset.name;
        const fileSize = parseInt(item.dataset.size);
        
        // Показываем подсказку
        const notification = document.createElement('div');
        notification.style.cssText = `
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: #2D2D2D;
          color: #E5E5E5;
          padding: 15px 25px;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          z-index: 1000000;
          font-size: 14px;
          animation: spritz-fade-in 0.2s ease-out;
        `;
        notification.textContent = `Выберите файл "${fileName}"`;
        document.body.appendChild(notification);
        
        setTimeout(() => {
          notification.style.opacity = '0';
          notification.style.transition = 'opacity 0.3s';
          setTimeout(() => notification.remove(), 300);
        }, 3000);
        
        fileInput.accept = getAcceptForFile(fileName);
        fileInput.click();
        
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
  
  function getAcceptForFile(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    if (ext === 'txt') return '.txt';
    if (ext === 'epub') return '.epub';
    if (ext === 'fb2') return '.fb2';
    if (ext === 'html' || ext === 'htm') return '.html,.htm';
    if (ext === 'docx') return '.docx';
    if (ext === 'pdf') return '.pdf';
    return '.txt,.html,.htm,.epub,.fb2,.docx,.pdf';
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
