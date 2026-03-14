import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import download from "downloadjs";

export function parseNumberList(input) {
  if (!input || !input.trim()) return [];
  const nums = new Set();
  input.split(",").forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) return;
    const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      let start = Number(rangeMatch[1]);
      let end = Number(rangeMatch[2]);
      if (!Number.isInteger(start) || !Number.isInteger(end)) return;
      if (start <= 0 || end <= 0) return;
      if (end < start) [start, end] = [end, start];
      for (let n = start; n <= end; n++) nums.add(n);
      return;
    }
    const n = Number(trimmed);
    if (Number.isInteger(n) && n > 0) nums.add(n);
  });
  return Array.from(nums);
}

export function sanitizePublicId(name) {
  if (!name) return "";
  return name
    .normalize("NFKD")
    .replace(/[^\w\-\/.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-200);
}

const A4_WIDTH_PTS = 595;
const A4_HEIGHT_PTS = 842;
const MARGIN = 20;
const USABLE_WIDTH = A4_WIDTH_PTS - 2 * MARGIN;

// Configuration for spacing
const SPACING = {
  HEADER_HEIGHT: 24, // Font size 14 + 10 padding
  LINE_HEIGHT: 12,
  AFTER_TEXT: 15,
  AFTER_IMAGE: 5,
  SEPARATOR: 30,
};

const safeEmbedImage = async (pdfDoc, imageUrl) => {
  try {
    const imageBytes = await fetch(imageUrl).then((res) => {
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return res.arrayBuffer();
    });

    let pdfImage;
    let imageExtension = imageUrl.split(".").pop().toLowerCase();

    if (imageExtension === "png") {
      pdfImage = await pdfDoc.embedPng(imageBytes);
    } else if (["jpg", "jpeg"].includes(imageExtension)) {
      pdfImage = await pdfDoc.embedJpg(imageBytes);
    } else {
      console.warn(`Skipping unsupported image format: ${imageExtension}`);
      return null;
    }
    return pdfImage;
  } catch (e) {
    console.error(`SafeEmbedImage failed for ${imageUrl}:`, e);
    return null;
  }
};

const wrapText = (font, text, size, maxWidth) => {
  if (!text) return [];
  const sanitizedText = text
    .replace(/[\r\n]+/g, " ")
    .replace(/[^\x00-\x7F]+/g, "")
    .trim();
  const words = sanitizedText.split(" ");
  if (words.length === 0 || words[0] === "") return [];

  let lines = [];
  let currentLine = words[0] || "";

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    if (!word) continue;
    const combinedLine = currentLine + " " + word;
    const width = font.widthOfTextAtSize(combinedLine, size);
    if (width < maxWidth) {
      currentLine = combinedLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
};

// Helper to check if we need a page break for a specific single element
const checkPageBreak = (cursorY, requiredHeight) => {
  return cursorY - requiredHeight < MARGIN;
};

export const exportQuestionsToPDF = async (
  questions,
  name,
  options = { includeNotes: true }, // Default option
) => {
  if (!questions || questions.length === 0) {
    alert("No questions available to export.");
    return;
  }

  const { includeNotes } = options;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Courier);
  const fontBold = await pdfDoc.embedFont(StandardFonts.CourierBold);

  let page = pdfDoc.addPage([A4_WIDTH_PTS, A4_HEIGHT_PTS]);
  let cursorY = A4_HEIGHT_PTS - MARGIN;

  for (let index = 0; index < questions.length; index++) {
    const question = questions[index];
    const questionNumber = index + 1;

    try {
      // --- PHASE 1: PRE-CALCULATION ---

      // 2. TEXT CALCULATION (Conditionally skipped)
      let textLines = [];
      let textBlockHeight = 0;
      const noteFontSize = 12;

      if (includeNotes && question.note) {
        textLines = wrapText(font, question.note, noteFontSize, USABLE_WIDTH);
        textBlockHeight = textLines.length * SPACING.LINE_HEIGHT;
      }

      // ... Image Processing (remains same) ...
      const processedImages = [];
      let totalImagesHeight = 0;

      if (question.images && question.images.length > 0) {
        for (const imageUrl of question.images) {
          if (!imageUrl) continue;
          const pdfImage = await safeEmbedImage(pdfDoc, imageUrl);
          if (!pdfImage) continue;

          const { width, height } = pdfImage;
          const scaleFactor = USABLE_WIDTH / width;
          let imgDisplayWidth = USABLE_WIDTH;
          let imgDisplayHeight = height * scaleFactor;

          const MAX_HEIGHT_RATIO = 0.5;
          const maxHeight = (A4_HEIGHT_PTS - 2 * MARGIN) * MAX_HEIGHT_RATIO;

          if (imgDisplayHeight > maxHeight) {
            imgDisplayHeight = maxHeight;
            imgDisplayWidth = width * (maxHeight / height);
          }

          processedImages.push({
            imgObj: pdfImage,
            width: imgDisplayWidth,
            height: imgDisplayHeight,
          });

          totalImagesHeight += imgDisplayHeight + SPACING.AFTER_IMAGE;
        }
      }

      // 3. Total Height Calculation
      const totalBlockHeight =
        SPACING.HEADER_HEIGHT +
        textBlockHeight +
        (textLines.length > 0 ? SPACING.AFTER_TEXT : 0) +
        totalImagesHeight +
        SPACING.SEPARATOR;

      // --- PHASE 2: PAGE BREAK ---
      const spaceRemaining = cursorY - MARGIN;
      const fullPageHeight = A4_HEIGHT_PTS - 2 * MARGIN;
      let forceNewPage = false;

      if (totalBlockHeight <= spaceRemaining) {
        forceNewPage = false;
      } else if (totalBlockHeight <= fullPageHeight) {
        forceNewPage = true;
      } else {
        if (spaceRemaining < fullPageHeight * 0.8) {
          forceNewPage = true;
        }
      }

      if (forceNewPage) {
        page = pdfDoc.addPage([A4_WIDTH_PTS, A4_HEIGHT_PTS]);
        cursorY = A4_HEIGHT_PTS - MARGIN;
      }

      // --- PHASE 3: DRAWING ---

      // Draw Header
      cursorY -= 14;
      page.drawText(`QUESTION ${questionNumber}`, {
        x: MARGIN,
        y: cursorY,
        size: 14,
        font: fontBold,
        color: rgb(0.0, 0.0, 0.0),
      });
      cursorY -= 10;

      // Draw Text (Only if lines exist)
      if (textLines.length > 0) {
        if (checkPageBreak(cursorY, textBlockHeight + SPACING.AFTER_TEXT)) {
          page = pdfDoc.addPage([A4_WIDTH_PTS, A4_HEIGHT_PTS]);
          cursorY = A4_HEIGHT_PTS - MARGIN;
        }

        for (const line of textLines) {
          cursorY -= SPACING.LINE_HEIGHT;
          page.drawText(line, {
            x: MARGIN,
            y: cursorY,
            size: noteFontSize,
            font: font,
            color: rgb(0.0, 0.0, 0.0),
          });
        }
        cursorY -= SPACING.AFTER_TEXT;
      }

      // Draw Images
      for (const imgData of processedImages) {
        const requiredHeight = imgData.height + SPACING.AFTER_IMAGE;
        if (checkPageBreak(cursorY, requiredHeight)) {
          page = pdfDoc.addPage([A4_WIDTH_PTS, A4_HEIGHT_PTS]);
          cursorY = A4_HEIGHT_PTS - MARGIN;
        }

        cursorY -= imgData.height;
        page.drawImage(imgData.imgObj, {
          x: MARGIN + (USABLE_WIDTH - imgData.width) / 2,
          y: cursorY,
          width: imgData.width,
          height: imgData.height,
        });

        // Optional Border
        page.drawRectangle({
          x: MARGIN + (USABLE_WIDTH - imgData.width) / 2,
          y: cursorY,
          width: imgData.width,
          height: imgData.height,
          borderWidth: 1,
          borderColor: rgb(0, 0, 0),
          color: rgb(0, 0, 0),
          opacity: 0,
          borderOpacity: 1,
        });

        cursorY -= SPACING.AFTER_IMAGE;
      }

      // Separator
      if (checkPageBreak(cursorY, 30)) {
        page = pdfDoc.addPage([A4_WIDTH_PTS, A4_HEIGHT_PTS]);
        cursorY = A4_HEIGHT_PTS - MARGIN;
      }
      cursorY -= 10;
      page.drawLine({
        start: { x: MARGIN, y: cursorY },
        end: { x: A4_WIDTH_PTS - MARGIN, y: cursorY },
        thickness: 0.5,
        color: rgb(0.0, 0.0, 0.0),
      });
      cursorY -= 5;
      page.drawLine({
        start: { x: MARGIN, y: cursorY },
        end: { x: A4_WIDTH_PTS - MARGIN, y: cursorY },
        thickness: 0.5,
        color: rgb(0.0, 0.0, 0.0),
      });
      cursorY -= 10;
    } catch (e) {
      console.error(`Skipping Question ${questionNumber} error:`, e);
      // Error handling...
    }
  }

  const pdfBytes = await pdfDoc.save();
  download(pdfBytes, `${name}.pdf`, "application/pdf");
};

export function evaluateTagQuery(query, questionTagNames) {
  if (!query || !query.trim()) return true;

  try {
    const qTagsLower = questionTagNames.map((t) => t.toLowerCase());

    const quoteRegex = /(["'])(.*?)\1/g;

    let processedQuery = query.replace(
      quoteRegex,
      (match, quote, innerString) => {
        const hasTag = qTagsLower.includes(innerString.toLowerCase());
        return hasTag ? " true " : " false ";
      },
    );

    processedQuery = processedQuery
      .replace(/\band\b/gi, " && ")
      .replace(/\bor\b/gi, " || ")
      .replace(/\bnot\b/gi, " ! ");

    const safeRegex = /^[truefals&|!()\s]+$/;
    if (!safeRegex.test(processedQuery)) {
      return false;
    }

    // eslint-disable-next-line no-new-func
    const result = new Function(`return !!(${processedQuery});`)();
    return result;
  } catch (e) {
    return false;
  }
}
