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
  } else if (fileName.endsWith('.docx')) {
    return await parseDocx(file);
  } else if (fileName.endsWith('.doc')) {
    return await parseDoc(file);
  } else if (fileName.endsWith('.pdf')) {
    return await parsePdf(file);
  } else {
    throw new Error('Неподдерживаемый формат. Используйте .txt, .html, .epub, .fb2, .doc, .docx или .pdf');
  }
}

// Универсальная функция чтения файла с автоопределением кодировки
async function readFileWithEncoding(file) {
  const buffer = await file.arrayBuffer();
  
  // Список кодировок для проверки (по порядку)
  const encodings = [
    'utf-8',
    'windows-1251',
    'koi8-r',
    'iso-8859-5',
    'macintosh',
    'x-mac-cyrillic',
    'windows-1252',
    'ibm866'
  ];
  
  let bestResult = null;
  let bestScore = -1;
  
  for (const encoding of encodings) {
    try {
      const decoder = new TextDecoder(encoding);
      const text = decoder.decode(buffer);
      
      // Проверяем качество декодирования
      let score = 0;
      
      // Проверяем на наличие замены символов ()
      if (!text.includes('')) {
        score += 10;
      }
      
      // Проверяем наличие русских букв
      const cyrillicCount = (text.match(/[а-яА-ЯёЁ]/g) || []).length;
      if (cyrillicCount > 50) {
        score += 20;
      }
      
      // Проверяем наличие типичных русских слов
      const commonWords = ['и', 'в', 'не', 'на', 'с', 'по', 'что', 'как', 'это', 'был', 'была', 'было', 'были'];
      const textLower = text.toLowerCase();
      for (const word of commonWords) {
        if (textLower.includes(' ' + word + ' ') || textLower.includes(' ' + word + ',')) {
          score += 5;
        }
      }
      
      // Проверяем на наличие XML-тегов (для FB2)
      if (text.includes('<?xml') || text.includes('<FictionBook')) {
        score += 15;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestResult = { text, encoding };
      }
    } catch (e) {
      // Кодировка не подошла
    }
  }
  
  return bestResult || { text: new TextDecoder('utf-8').decode(buffer), encoding: 'UTF-8' };
}

// Чтение .txt
async function parseTxt(file) {
  const result = await readFileWithEncoding(file);
  console.log(`Файл ${file.name} прочитан в кодировке: ${result.encoding}`);
  return result.text;
}

// Чтение .html
async function parseHtml(file) {
  const result = await readFileWithEncoding(file);
  console.log(`HTML файл ${file.name} прочитан в кодировке: ${result.encoding}`);
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(result.text, 'text/html');
  
  doc.querySelectorAll('script, style, nav, header, footer').forEach(el => el.remove());
  
  const elements = doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, article, section');
  
  let fullText = '';
  elements.forEach(el => {
    const text = el.textContent.trim();
    if (text) {
      fullText += text + ' ';
    }
  });
  
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
    throw new Error('Библиотека JSZip не загружена');
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

// Чтение .fb2
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

// Чтение .docx
async function parseDocx(file) {
  if (typeof mammoth === 'undefined') {
    throw new Error('Библиотека mammoth.js не загружена');
  }
  
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  
  if (!result.value.trim()) {
    throw new Error('Не удалось извлечь текст из DOCX файла');
  }
  
  return result.value.trim();
}

// Чтение .doc (старый формат Word)
async function parseDoc(file) {
  // Для .doc используем простую эвристику - читаем как текст
  // Это не идеально, но лучше чем ничего
  const result = await readFileWithEncoding(file);
  
  // Удаляем бинарные данные, оставляем только читаемый текст
  const cleanedText = result.text.replace(/[^\x20-\x7Eа-яА-ЯёЁ\s.,;:!?\-]/g, ' ');
  const lines = cleanedText.split('\n').filter(line => line.trim().length > 2);
  const text = lines.join(' ');
  
  if (!text.trim()) {
    throw new Error('Не удалось извлечь текст из DOC файла. Попробуйте сохранить файл в формате .docx');
  }
  
  return text.trim();
}

// Чтение .pdf
async function parsePdf(file) {
  if (typeof pdfjsLib === 'undefined') {
    throw new Error('Библиотека pdf.js не загружена');
  }
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    const pageText = textContent.items
      .map(item => item.str)
      .join(' ');
    
    fullText += pageText + ' ';
  }
  
  if (!fullText.trim()) {
    throw new Error('Не удалось извлечь текст из PDF файла');
  }
  
  return fullText.trim();
}
