// ==================== PDF BALIZAMENTO PARSER ====================
// Os PDFs de balizamento (sistema ABMN/Swim It Up!) não têm camada de
// texto — o conteúdo é desenhado como vetores. Por isso o fluxo é:
// 1) renderizar cada página como imagem (pdf.js)
// 2) rodar OCR sobre a imagem (Tesseract.js), pegando a posição (x,y)
//    de cada palavra reconhecida
// 3) reagrupar palavras em linhas por proximidade vertical
// 4) usar a posição X de cada palavra + os limites de coluna do
//    cabeçalho "RAIA MATR. FAIXA ATLETA EQUIPE TEMPO" pra remontar
//    cada linha de atleta com o campo correto
//
// OCR nunca é 100% confiável, então o resultado sempre inclui uma
// lista de "avisos" e o app.js exige revisão manual antes de salvar.

const RENDER_SCALE = 3.5;

async function parseBalizamentoPDF(file, { onProgress } = {}) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const totalPages = pdf.numPages;

  const worker = await Tesseract.createWorker('por', 1, {
    logger: info => {
      if (onProgress && info.status === 'recognizing text') {
        onProgress({ stage: 'ocr', progress: info.progress });
      }
    }
  });
  // PSM 6 (bloco único uniforme) reconhece a tabela bem melhor que o
  // modo automático padrão — validado manualmente com esse mesmo PDF.
  await worker.setParameters({ tessedit_pageseg_mode: '6' });

  const provas = [];
  const warnings = [];
  let provaAtual = null;
  let serieAtual = null;
  let colBounds = null; // {RAIA,MATR,FAIXA,ATLETA,EQUIPE,TEMPO} -> x0

  try {
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (onProgress) onProgress({ stage: 'render', page: pageNum, totalPages });

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;

      if (onProgress) onProgress({ stage: 'ocr-start', page: pageNum, totalPages });
      const { data } = await worker.recognize(canvas);

      const lines = groupWordsIntoLines(data.words || []);

      for (const line of lines) {
        const text = line.map(w => w.text).join(' ').trim();
        if (!text) continue;
        if (isBoilerplate(text)) continue;

        const headerBounds = tryParseColumnHeader(line);
        if (headerBounds) { colBounds = headerBounds; continue; }

        const provaMatch = tryParseProvaHeader(text);
        if (provaMatch) {
          if (provaAtual) provas.push(provaAtual);
          provaAtual = { num: provaMatch.num, nome: provaMatch.nome, horario: null, termino: null, series: [] };
          serieAtual = null;
          continue;
        }

        const termino = tryParseTermino(text);
        if (termino && provaAtual) {
          provaAtual.termino = termino;
          continue;
        }

        const serieMatch = tryParseSerieHeader(text);
        if (serieMatch && provaAtual) {
          serieAtual = { serie: provaAtual.series.length + 1, horario: serieMatch.horario, atletas: [] };
          provaAtual.series.push(serieAtual);
          if (!provaAtual.horario) provaAtual.horario = serieMatch.horario;
          continue;
        }

        if (provaAtual && serieAtual && colBounds) {
          const athlete = tryParseAthleteLine(line, colBounds);
          if (athlete) {
            const problems = validateAthlete(athlete);
            if (problems.length) {
              warnings.push({
                prova: provaAtual.num, serie: serieAtual.serie,
                raw: text, problems
              });
            }
            serieAtual.atletas.push(athlete);
            continue;
          }
        }

        // linha não reconhecida por nenhum padrão — registra como aviso solto
        if (provaAtual) {
          warnings.push({
            prova: provaAtual.num, serie: serieAtual ? serieAtual.serie : null,
            raw: text, problems: ['linha não reconhecida']
          });
        }
      }
    }
    if (provaAtual) provas.push(provaAtual);
  } finally {
    await worker.terminate();
  }

  const totalAtletas = provas.reduce((n, p) => n + p.series.reduce((m, s) => m + s.atletas.length, 0), 0);
  return { provas, warnings, totalAtletas };
}

function groupWordsIntoLines(words) {
  if (!words.length) return [];
  const withCenter = words
    .filter(w => w.text && w.text.trim())
    .map(w => ({ text: w.text.trim(), x0: w.bbox.x0, x1: w.bbox.x1, yc: (w.bbox.y0 + w.bbox.y1) / 2, h: w.bbox.y1 - w.bbox.y0 }));
  withCenter.sort((a, b) => a.yc - b.yc);

  const lines = [];
  let current = [];
  let currentY = null;
  const tol = withCenter.length ? Math.max(8, (withCenter.reduce((s, w) => s + w.h, 0) / withCenter.length) * 0.6) : 10;

  for (const w of withCenter) {
    if (currentY === null || Math.abs(w.yc - currentY) <= tol) {
      current.push(w);
      currentY = current.reduce((s, x) => s + x.yc, 0) / current.length;
    } else {
      current.sort((a, b) => a.x0 - b.x0);
      lines.push(current);
      current = [w];
      currentY = w.yc;
    }
  }
  if (current.length) { current.sort((a, b) => a.x0 - b.x0); lines.push(current); }
  return lines;
}

function isBoilerplate(text) {
  return /^Balizamento$/i.test(text) ||
    /MEETING|TROF[EÉ]U|ABMN Competi|comprovante|Data:\s*\d|^associa[çc][ãa]o$/i.test(text) ||
    /^\d{2}\/\d{2}\/\d{4}\s*\(25\s*METROS/i.test(text) ||
    /^[A-ZÀ-Ú ]+ - [A-ZÀ-Ú\/]+$/i.test(text) && /CLUBE|COUNTRY|MARINGA/i.test(text);
}

function tryParseColumnHeader(line) {
  const texts = line.map(w => w.text.toUpperCase());
  const idxRaia = texts.findIndex(t => t === 'RAIA');
  const idxMatr = texts.findIndex(t => t.startsWith('MATR'));
  const idxFaixa = texts.findIndex(t => t.startsWith('FAIXA'));
  const idxAtleta = texts.findIndex(t => t.startsWith('ATLETA'));
  const idxEquipe = texts.findIndex(t => t.startsWith('EQUIPE'));
  const idxTempo = texts.findIndex(t => t.startsWith('TEMPO'));
  if ([idxRaia, idxMatr, idxFaixa, idxAtleta, idxEquipe, idxTempo].some(i => i === -1)) return null;
  return {
    RAIA: line[idxRaia].x0, MATR: line[idxMatr].x0, FAIXA: line[idxFaixa].x0,
    ATLETA: line[idxAtleta].x0, EQUIPE: line[idxEquipe].x0, TEMPO: line[idxTempo].x0
  };
}

function tryParseProvaHeader(text) {
  const m = text.match(/(\d{1,2})[ºªo°]?\s*PROVA\s*[-–—]\s*(.+?)\s*\(\d{2}\/\d{2}\/\d{4}\)/i);
  if (!m) return null;
  return { num: parseInt(m[1], 10), nome: toTitleCasePt(m[2].trim()) };
}

function tryParseSerieHeader(text) {
  if (!/S[ÉE]RIE/i.test(text)) return null;
  const m = text.match(/IN[ÍI]CIO\s*[:.]?\s*(\d{1,2}:\d{2})/i);
  if (!m) return null;
  return { horario: m[1] };
}

function tryParseTermino(text) {
  if (!/T[ÉE]RMINO/i.test(text)) return null;
  const m = text.match(/(\d{1,2}:\d{2})/);
  return m ? m[1] : null;
}

function tryParseAthleteLine(line, colBounds) {
  const first = line[0];
  if (!/^\d{1,2}[º°ªo]?$/.test(first.text)) return null;
  const raia = parseInt(first.text, 10);
  if (!raia || raia < 1 || raia > 12) return null;

  const rest = line.slice(1);
  if (!rest.length) return null;

  const boundsList = [
    ['MATR', colBounds.MATR], ['FAIXA', colBounds.FAIXA], ['ATLETA', colBounds.ATLETA],
    ['EQUIPE', colBounds.EQUIPE], ['TEMPO', colBounds.TEMPO]
  ].sort((a, b) => a[1] - b[1]);

  const buckets = { MATR: [], FAIXA: [], ATLETA: [], EQUIPE: [], TEMPO: [] };
  for (const w of rest) {
    let col = boundsList[0][0];
    for (const [name, x] of boundsList) {
      if (w.x0 >= x - 15) col = name; else break;
    }
    buckets[col].push(w.text);
  }

  const matrRaw = buckets.MATR.join('').replace(/[^\d]/g, '');
  const faixa = buckets.FAIXA.join(' ').replace(/\s*\+/g, '+').replace(/PR[EÉ]/i, 'PRÉ').trim();
  const nome = toTitleCasePt(buckets.ATLETA.join(' ').trim());
  const equipe = buckets.EQUIPE.join(' ').trim().toUpperCase();
  const tempoRaw = buckets.TEMPO.join(' ').replace(/\s+/g, '').toUpperCase();

  return {
    raia, matr: matrRaw ? parseInt(matrRaw, 10) : null,
    faixa: faixa || '', nome: nome || '', clube: equipe || '',
    tempo: normalizeTempo(tempoRaw)
  };
}

function normalizeTempo(raw) {
  // "S/T" = sem tempo (atleta ainda não tem marca registrada) — o OCR
  // costuma confundir a barra com I/1/L, então aceita essas variações.
  if (/^[S5][\/I1Ll]?T\.?$/i.test(raw)) return 'S/T';
  const m = raw.match(/^(\d{1,2}:\d{2}\.\d{2}|\d{1,3}\.\d{2})$/);
  return m ? m[1] : raw;
}

function validateAthlete(a) {
  const problems = [];
  if (!a.matr) problems.push('matrícula inválida');
  if (!a.nome) problems.push('nome vazio');
  if (!a.clube) problems.push('clube vazio');
  if (!/^(S\/T|\d{1,2}:\d{2}\.\d{2}|\d{1,3}\.\d{2})$/.test(a.tempo)) problems.push('tempo em formato inesperado');
  return problems;
}

function toTitleCasePt(s) {
  const lower = ['DE', 'DA', 'DO', 'DOS', 'DAS', 'E', 'A', 'O'];
  return s.split(' ').filter(Boolean).map((w, i) => {
    if (i > 0 && lower.includes(w.toUpperCase())) return w.toLowerCase();
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
}
