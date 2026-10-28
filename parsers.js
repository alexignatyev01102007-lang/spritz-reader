// Чтение файла в зависимости от формата
async function parseFile(file) {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.txt')) {
    return await parseTxt(file);
  } else if (fileName.endsWith('.html') || fileName.endsWith('.htm')) {
    return await parseHtml(file);
  } else if (fileName.endsWith('.epub')) {
    return await parseEpub(file);
  } else if (fileName.endsWith('.fb2')) {
    return await parseFb2(file);
  } else {
    throw new Error('Неподдерживаемый формат. Используйте .txt, .html, .epub или .fb2');
  }
}

// Универсальная функция чтения файла с автоопределением кодировки
async function readFileWithEncoding(file) {
  // Сначала пробуем как UTF-8
  const utf8Text = await file.text();
  
  // Проверяем, есть ли "битые" символы (замена неизвестных символов)
  // Символ  - это U+FFFD, появляется при ошибке декодирования
  if (!utf8Text.includes('')) {
    return { text: utf8Text, encoding: 'UTF-8' };
  }
  
  // Если есть битые символы — пробуем Windows-1251 (самая частая для русских FB2)
  try {
    const buffer = await file.arrayBuffer();
    const decoder = new TextDecoder('windows-1251');
    const cp1251Text = decoder.decode(buffer);
    
    // Проверяем, что текст выглядит как нормальный (есть русские буквы)
    if (/[а-яА-ЯёЁ]/.test(cp1251Text)) {
      return { text: cp1251Text, encoding: 'Windows-1251' };
    }
  } catch (e) {
    console.log('Ошибка декодирования Windows-1251:', e);
  }
  
  // Пробуем KOI8-R (старая советская кодировка)
  try {
    const buffer = await file.arrayBuffer();
    const decoder = new TextDecoder('koi8-r');
    const koi8Text = decoder.decode(buffer);
    
    if (/[а-яА-ЯёЁ]/.test(koi8Text)) {
      return { text: koi8Text, encoding: 'KOI8-R' };
    }
  } catch (e) {
    console.log('Ошибка декодирования KOI8-R:', e);
  }
  
  // Если ничего не помогло — возвращаем UTF-8 как есть
  return { text: utf8Text, encoding: 'UTF-8 (возможно, неверно)' };
}

// Чтение .txt с автоопределением кодировки
async function parseTxt(file) {
  const result = await readFileWithEncoding(file);
  console.log(`Файл ${file.name} прочитан в кодировке: ${result.encoding}`);
  return result.text;
}

// Чтение .html
async function parseHtml(file) {
  const result = await readFileWithEncoding(file);
  console.log(`HTML файл ${file.name} прочитан в кодировке: ${result.encoding}`);
  
  // Парсим HTML и извлекаем текст
  const parser = new DOMParser();
  const doc = parser.parseFromString(result.text, 'text/html');
  
  // Удаляем скрипты и стили
  doc.querySelectorAll('script, style, nav, header, footer').forEach(el => el.remove());
  
  // Извлекаем текст из основных элементов
  const elements = doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, article, section');
  
  let fullText = '';
  elements.forEach(el => {
    const text = el.textContent.trim();
    if (text) {
      fullText += text + ' ';
    }
  });
  
  // Если не нашли ничего в структурных элементах — берём весь body
  if (!fullText.trim()) {
    fullText = doc.body ? doc.body.textContent : result.text;
  }
  
  if (!fullText.trim()) {
    throw new Error('Не удалось извлечь текст из HTML файла');
  }
  
  return fullText.trim();
}

// Чтение .epub
async function parseEpub(file) {
  if (typeof JSZip === 'undefined') {
    throw new Error('Библиотека JSZip не загружена. Проверьте подключение в index.html');
  }
  
  const zip = await JSZip.loadAsync(file);
  
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) {
    throw new Error('Неверный формат EPUB: отсутствует container.xml');
  }
  
  const containerXml = await containerFile.async('text');
  const containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml');
  
  const rootfile = containerDoc.querySelector('rootfile');
  if (!rootfile) {
    throw new Error('Неверный формат EPUB: отсутствует rootfile');
  }
  
  const opfPath = rootfile.getAttribute('full-path');
  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    throw new Error('Неверный формат EPUB: отсутствует content.opf');
  }
  
  const opfXml = await opfFile.async('text');
  const opfDoc = new DOMParser().parseFromString(opfXml, 'application/xml');
  
  const manifestItems = {};
  opfDoc.querySelectorAll('item').forEach(item => {
    manifestItems[item.getAttribute('id')] = {
      href: item.getAttribute('href'),
      mediaType: item.getAttribute('media-type')
    };
  });
  
  const spine = opfDoc.querySelectorAll('spine itemref');
  
  let fullText = '';
  const basePath = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
  
  for (const itemref of spine) {
    const idref = itemref.getAttribute('idref');
    const item = manifestItems[idref];
    
    if (item && item.mediaType && item.mediaType.includes('xml')) {
      const filePath = basePath + item.href;
      const xhtmlFile = zip.file(filePath);
      
      if (xhtmlFile) {
        const xhtmlContent = await xhtmlFile.async('text');
        const xhtmlDoc = new DOMParser().parseFromString(xhtmlContent, 'application/xhtml+xml');
        
        const paragraphs = xhtmlDoc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
        paragraphs.forEach(p => {
          const text = p.textContent.trim();
          if (text) {
            fullText += text + ' ';
          }
        });
      }
    }
  }
  
  if (!fullText.trim()) {
    throw new Error('Не удалось извлечь текст из EPUB файла');
  }
  
  return fullText.trim();
}

// Чтение .fb2 с автоопределением кодировки
async function parseFb2(file) {
  const result = await readFileWithEncoding(file);
  console.log(`FB2 файл ${file.name} прочитан в кодировке: ${result.encoding}`);
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(result.text, 'application/xml');
  
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Ошибка парсинга FB2: неверный XML формат');
  }
  
  const bodies = doc.querySelectorAll('body');
  if (bodies.length === 0) {
    throw new Error('Неверный формат FB2: отсутствует body');
  }
  
  let fullText = '';
  
  bodies.forEach(body => {
    const paragraphs = body.querySelectorAll('p, title, subtitle, poem stanza');
    paragraphs.forEach(p => {
      const text = p.textContent.trim();
      if (text) {
        fullText += text + ' ';
      }
    });
  });
  
  if (!fullText.trim()) {
    throw new Error('Не удалось извлечь текст из FB2 файла');
  }
  
  return fullText.trim();
}