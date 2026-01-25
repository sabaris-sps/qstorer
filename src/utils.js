import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import download from "downloadjs"; // For triggering the download

export function sanitizePublicId(name) {
  if (!name) return "";

  return name
    .normalize("NFKD") // break apart combined characters
    .replace(/[^\w\-\/.]+/g, "-") // replace disallowed chars (no emojis)
    .replace(/-+/g, "-") // collapse multiple dashes
    .replace(/^-+|-+$/g, "") // trim starting/ending dashes
    .slice(-200); // limit length for safety
}

// A standard A4 size in points
const A4_WIDTH_PTS = 595;
const A4_HEIGHT_PTS = 842;
const MARGIN = 20; // 30 points (~10mm) margin
const USABLE_WIDTH = A4_WIDTH_PTS - 2 * MARGIN;

/**
 * Safely fetches and embeds an image. Returns null on failure.
 */
const safeEmbedImage = async (pdfDoc, imageUrl) => {
  try {
    const imageBytes = await fetch(imageUrl).then((res) => {
      if (!res.ok) {
        // Throw an error if the HTTP status is not 200-299
        throw new Error(`HTTP error! status: ${res.status}`);
      }
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

/**
 * Manually wraps text based on font size and available width.
 * @param {PDFFont} font - The embedded font object (Helvetica).
 * @param {string} text - The text to wrap.
 * @param {number} size - Font size.
 * @param {number} maxWidth - The available width in points.
 * @returns {Array<string>} - An array of wrapped lines.
 */
const wrapText = (font, text, size, maxWidth) => {
  if (!text) return [];

  // FIX: Replace newlines with space, then strip all non-ASCII/control characters
  // that the standard PDF font cannot encode.
  const sanitizedText = text
    .replace(/[\r\n]+/g, " ")
    .replace(/[^\x00-\x7F]+/g, "") // Strip non-ASCII characters (e.g., weird unicode)
    .trim();
  const words = sanitizedText.split(" ");

  if (words.length === 0 || words[0] === "") return [];

  let lines = [];
  let currentLine = words[0] || "";

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    if (!word) continue; // Skip empty strings that might result from extra spaces

    const combinedLine = currentLine + " " + word;

    // Measure the width of the combined line
    const width = font.widthOfTextAtSize(combinedLine, size);

    if (width < maxWidth) {
      currentLine = combinedLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine); // Push the last line
  return lines;
};

// Helper to check if new content fits on the current page
const checkPageBreak = (page, cursorY, requiredHeight) => {
  // Check if the Y-coordinate of the bottom of the new content
  // (cursorY - requiredHeight) falls below the bottom MARGIN.
  if (cursorY - requiredHeight < MARGIN) {
    return true; // Indicates a page break is needed
  }
  return false;
};

/**
 * Exports all questions (notes and images) to a single A4 PDF document using pdf-lib.
 * @param {Array<Object>} questions - The list of question objects.
 */
export const exportQuestionsToPDF = async (questions) => {
  if (!questions || questions.length === 0) {
    alert("No questions available to export.");
    return;
  }

  // 1. Setup Document
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Courier);
  const fontBold = await pdfDoc.embedFont(StandardFonts.CourierBold);

  let page = pdfDoc.addPage([A4_WIDTH_PTS, A4_HEIGHT_PTS]);
  let cursorY = A4_HEIGHT_PTS - MARGIN; // Start at top margin

  // 2. Iterate through Questions
  for (let index = 0; index < questions.length; index++) {
    const question = questions[index];
    const questionNumber = index + 1;

    try {
      // --- Question Header ---
      const headerText = `QUESTION ${questionNumber}`;
      const headerFontSize = 14;
      const headerHeight = headerFontSize + 10;

      // Calculate where the cursor MUST be *after* drawing the header (top-aligned)
      const newCursorYHeader = cursorY - headerHeight;

      // Check break (add page if needed)
      if (checkPageBreak(page, cursorY, headerHeight)) {
        // Check if space is available for header
        page = pdfDoc.addPage([A4_WIDTH_PTS, A4_HEIGHT_PTS]);
        cursorY = A4_HEIGHT_PTS - MARGIN;
      }

      cursorY -= headerFontSize; // Set cursor for drawing (draws from cursorY upwards)
      page.drawText(headerText, {
        x: MARGIN,
        y: cursorY,
        size: headerFontSize,
        font: fontBold,
        color: rgb(0.0, 0.0, 0.0), // Primary blue color
      });
      cursorY -= 10; // Space after header

      // --- Note Section ---
      const noteText = question.note || ""; // Use 'note' property
      const noteFontSize = 12;
      const lineHeight = 12;

      // *** FIX APPLIED HERE: Use the custom wrapText helper ***
      const textLines = wrapText(font, noteText, noteFontSize, USABLE_WIDTH);
      // *** END FIX ***

      const textBlockHeight = textLines.length * lineHeight;
      const totalNoteHeight = textBlockHeight + 15; // Block height + post-note space

      // Check break (add page if needed)
      if (checkPageBreak(page, cursorY, totalNoteHeight)) {
        page = pdfDoc.addPage([A4_WIDTH_PTS, A4_HEIGHT_PTS]);
        cursorY = A4_HEIGHT_PTS - MARGIN;
      }

      // Draw text line by line, updating cursorY with each line
      for (const line of textLines) {
        cursorY -= lineHeight;
        page.drawText(line, {
          x: MARGIN,
          y: cursorY,
          size: noteFontSize,
          font: font,
          color: rgb(0.0, 0.0, 0.0),
        });
      }
      cursorY -= 15; // Space after notes

      // --- Images ---
      if (question.images && question.images.length > 0) {
        for (let imgIndex = 0; imgIndex < question.images.length; imgIndex++) {
          const imageUrl = question.images[imgIndex];

          if (!imageUrl) continue;

          // --- USE NEW SAFE HELPER ---
          const pdfImage = await safeEmbedImage(pdfDoc, imageUrl);

          if (!pdfImage) {
            // If embedding failed, draw a placeholder and continue to the next image/question.
            cursorY -= 30;
            page.drawText(
              `[Image Failed to Load: ${imageUrl.substring(0, 50)}...]`,
              {
                x: MARGIN,
                y: cursorY,
                size: 8,
                color: rgb(0.8, 0, 0),
              }
            );
            cursorY -= 10;
            continue;
          }
          // ---------------------------

          // Calculate Dimensions for A4 fit
          const { width, height } = pdfImage;
          // ... (Rest of Fix 1 logic for sizing) ...

          // 1. Maintain aspect ratio and fit to USABLE_WIDTH
          const scaleFactor = USABLE_WIDTH / width;
          let imgDisplayWidth = USABLE_WIDTH;
          let imgDisplayHeight = height * scaleFactor;
          const imgPadding = 5;

          // 2. DIMINISHING FIX (keep this for smaller images)
          const MAX_HEIGHT_RATIO = 0.5;
          const maxHeight = (A4_HEIGHT_PTS - 2 * MARGIN) * MAX_HEIGHT_RATIO;

          if (imgDisplayHeight > maxHeight) {
            imgDisplayHeight = maxHeight; // Cap the height
            imgDisplayWidth = width * (maxHeight / height); // Recalculate width based on capped height
          }

          // 3. Page Break Check
          const requiredHeight = imgDisplayHeight + imgPadding;

          if (checkPageBreak(page, cursorY, requiredHeight)) {
            page = pdfDoc.addPage([A4_WIDTH_PTS, A4_HEIGHT_PTS]);
            cursorY = A4_HEIGHT_PTS - MARGIN;
          }

          cursorY -= imgDisplayHeight; // Move cursor to the top of the image position

          page.drawImage(pdfImage, {
            x: MARGIN + (USABLE_WIDTH - imgDisplayWidth) / 2, // Center the image if scaled down
            y: cursorY,
            width: imgDisplayWidth,
            height: imgDisplayHeight,
          });
          page.drawRectangle({
            x: MARGIN + (USABLE_WIDTH - imgDisplayWidth) / 2, // Center the image if scaled down
            y: cursorY,
            width: imgDisplayWidth,
            height: imgDisplayHeight,
            borderWidth: 1,
            borderColor: rgb(0,0,0),
            color: rgb(0,0,0),
            opacity: 0,
            borderOpacity: 1,
          });

          cursorY -= imgPadding; // Space after image
        }
      }
      // ... (Rest of the outer loop) ...

      // --- Separator ---
      const separatorThickness = 0.5;
      const totalSeparatorSpace = 30; // 20 points of space before + line thickness + 20 points of space after

      if (checkPageBreak(page, cursorY, totalSeparatorSpace)) {
        page = pdfDoc.addPage([A4_WIDTH_PTS, A4_HEIGHT_PTS]);
        cursorY = A4_HEIGHT_PTS - MARGIN;
      }

      cursorY -= 10; // Space before the line

      // Draw dividing line
      page.drawLine({
        start: { x: MARGIN, y: cursorY },
        end: { x: A4_WIDTH_PTS - MARGIN, y: cursorY },
        thickness: separatorThickness,
        color: rgb(0.0, 0.0, 0.0),
      });

      cursorY -= 5; // Space after the line (40 total points of vertical space used)
      
      page.drawLine({
        start: { x: MARGIN, y: cursorY },
        end: { x: A4_WIDTH_PTS - MARGIN, y: cursorY },
        thickness: separatorThickness,
        color: rgb(0.0, 0.0, 0.0),
      });
      cursorY -= 10;
    } catch (e) {
      // Log the failure but allow the overall function to continue to the next question.
      console.error(
        `Skipping Question ${questionNumber} due to critical error:`,
        e
      );

      // Draw a large failure message for this question in the PDF
      page = pdfDoc.addPage([A4_WIDTH_PTS, A4_HEIGHT_PTS]);
      cursorY = A4_HEIGHT_PTS - MARGIN - 20;
      page.drawText(`--- QUESTION ${questionNumber} FAILED TO EXPORT ---`, {
        x: MARGIN,
        y: cursorY,
        size: 16,
        font: fontBold,
        color: rgb(0.8, 0, 0),
      });
    }
  }

  // 3. Finalize and Download
  const pdfBytes = await pdfDoc.save();
  download(pdfBytes, "QStorer_Export.pdf", "application/pdf");
};
