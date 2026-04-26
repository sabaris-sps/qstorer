import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import download from "downloadjs";
import React from "react";
import { createRoot } from "react-dom/client";
import html2canvas from "html2canvas";
import MarkdownRenderer from "./components/MarkdownRenderer";

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

// Helper to render Markdown/Math to a PNG image for PDF embedding
const renderNoteToImage = async (note) => {
  if (!note || !note.trim()) return null;

  const container = document.createElement("div");
  container.style.width = `${USABLE_WIDTH}px`;
  container.style.padding = "0px";
  container.style.backgroundColor = "white";
  container.style.color = "black";
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "0";
  container.style.zIndex = "-9999";
  container.style.pointerEvents = "none";
  document.body.appendChild(container);

  const root = createRoot(container);
  // Force styles on the wrapper to ensure visibility during capture
  root.render(
    <div className="export-container" style={{ color: "black", backgroundColor: "white", width: "100%", textAlign: "left", padding: "5px" }}>
      <style>{`
        .export-container *, .export-container h1, .export-container h2, .export-container h3, .export-container h4, .export-container h5, .export-container h6 { 
          color: black !important; 
          border-color: black !important;
          margin-top: 0 !important;
        }
        .export-container .katex { color: black !important; }
        .export-container .katex * { color: black !important; }
        .export-container p:first-child { margin-top: 0 !important; }
        .export-container p:last-child { margin-bottom: 0 !important; }
      `}</style>
      <MarkdownRenderer content={note} />
    </div>
  );

  // Wait for KaTeX to render
  await new Promise((resolve) => setTimeout(resolve, 2500));

  try {
    const canvas = await html2canvas(container, {
      backgroundColor: "#ffffff",
      scale: 3, // High quality
      useCORS: true,
      logging: false,
    });
    const dataUrl = canvas.toDataURL("image/png");
    root.unmount();
    document.body.removeChild(container);
    return dataUrl;
  } catch (err) {
    console.error("Failed to render note to image:", err);
    if (root) root.unmount();
    if (container.parentNode) document.body.removeChild(container);
    return null;
  }
};

const safeEmbedImage = async (pdfDoc, imageUrl) => {
  try {
    // Handle data URLs (generated from notes)
    if (imageUrl.startsWith("data:image/")) {
      const base64Data = imageUrl.split(",")[1];
      const imageBytes = Uint8Array.from(atob(base64Data), (c) =>
        c.charCodeAt(0),
      );
      if (imageUrl.includes("image/png")) return await pdfDoc.embedPng(imageBytes);
      if (imageUrl.includes("image/jpeg")) return await pdfDoc.embedJpg(imageBytes);
      return null;
    }

    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    const imageBytes = await response.arrayBuffer();

    let pdfImage;
    if (contentType.includes("image/png")) {
      pdfImage = await pdfDoc.embedPng(imageBytes);
    } else if (contentType.includes("image/jpeg") || contentType.includes("image/jpg")) {
      pdfImage = await pdfDoc.embedJpg(imageBytes);
    } else {
      // Fallback to extension if content-type is missing or generic
      let imageExtension = imageUrl.split(".").pop().toLowerCase().split(/[?#]/)[0];
      if (imageExtension === "png") {
        pdfImage = await pdfDoc.embedPng(imageBytes);
      } else if (["jpg", "jpeg"].includes(imageExtension)) {
        pdfImage = await pdfDoc.embedJpg(imageBytes);
      } else {
        console.warn(`Skipping unsupported image format: ${contentType || imageExtension}`);
        return null;
      }
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
  // Using Courier for the requested monospace look
  const font = await pdfDoc.embedFont(StandardFonts.Courier);
  const fontBold = await pdfDoc.embedFont(StandardFonts.CourierBold);

  let page = pdfDoc.addPage([A4_WIDTH_PTS, A4_HEIGHT_PTS]);
  let cursorY = A4_HEIGHT_PTS - MARGIN;

  for (let index = 0; index < questions.length; index++) {
    const question = questions[index];
    const questionNumber = index + 1;

    try {
      // --- PHASE 1: PRE-CALCULATION ---

      // Note Image Calculation
      let noteImage = null;
      let noteDisplayWidth = 0;
      let noteDisplayHeight = 0;

      if (includeNotes && question.note) {
        const noteDataUrl = await renderNoteToImage(question.note);
        if (noteDataUrl) {
          noteImage = await safeEmbedImage(pdfDoc, noteDataUrl);
          if (noteImage) {
            const { width, height } = noteImage;
            // Use natural width if it's smaller than USABLE_WIDTH to avoid pixelation
            // (Note: renderNoteToImage uses USABLE_WIDTH for container width)
            const scaleFactor = USABLE_WIDTH / width;
            noteDisplayWidth = USABLE_WIDTH;
            noteDisplayHeight = height * scaleFactor;
          }
        }
      }

      // Process Images with Smart Scaling and Grid Layout
      const imageRows = [];
      if (question.images && question.images.length > 0) {
        let currentRow = [];
        let currentRowWidth = 0;
        const GAP = 10;

        for (const imageUrl of question.images) {
          if (!imageUrl) continue;
          const pdfImage = await safeEmbedImage(pdfDoc, imageUrl);
          if (!pdfImage) continue;

          const { width, height } = pdfImage;
          
          // Calculate a single scale factor to maintain aspect ratio perfectly
          let scaleFactor = 1.0;
          
          // Constraint 1: Width limit
          if (width > USABLE_WIDTH) {
            scaleFactor = USABLE_WIDTH / width;
          }
          
          // Constraint 2: Height limit (max 45% of page)
          const MAX_HEIGHT = (A4_HEIGHT_PTS - 2 * MARGIN) * 0.45;
          if (height * scaleFactor > MAX_HEIGHT) {
            scaleFactor = MAX_HEIGHT / height;
          }

          const imgDisplayWidth = width * scaleFactor;
          const imgDisplayHeight = height * scaleFactor;
          const imgData = { imgObj: pdfImage, width: imgDisplayWidth, height: imgDisplayHeight, originalScale: scaleFactor };

          // 4. Grid Logic: Can we fit this in the current row?
          // Don't grid images that were already heavily scaled down (e.g., < 0.7 original size)
          // or if they are wider than 50% of usable width
          const isHeavilyScaled = scaleFactor < 0.7;
          const canFitInRow = !isHeavilyScaled && 
                             (currentRowWidth + GAP + imgDisplayWidth) <= USABLE_WIDTH && 
                             imgDisplayWidth < USABLE_WIDTH * 0.5;
          
          if (currentRow.length > 0 && canFitInRow) {
            currentRow.push(imgData);
            currentRowWidth += GAP + imgDisplayWidth;
          } else {
            if (currentRow.length > 0) imageRows.push({ images: currentRow, width: currentRowWidth, height: Math.max(...currentRow.map(i => i.height)) });
            currentRow = [imgData];
            currentRowWidth = imgDisplayWidth;
          }
        }
        if (currentRow.length > 0) {
          imageRows.push({ images: currentRow, width: currentRowWidth, height: Math.max(...currentRow.map(i => i.height)) });
        }
      }

      // --- PHASE 2: DRAWING ---

      // Smart Header Grouping: Ensure header + first content (note or first image row) stay together
      let firstContentHeight = 0;
      if (noteImage) {
        firstContentHeight = noteDisplayHeight + SPACING.AFTER_TEXT;
      } else if (imageRows.length > 0) {
        firstContentHeight = imageRows[0].height + SPACING.AFTER_IMAGE;
      }
      
      const headerWithContentHeight = 30 + firstContentHeight; // 30 is approx header + padding

      if (checkPageBreak(cursorY, headerWithContentHeight)) {
        page = pdfDoc.addPage([A4_WIDTH_PTS, A4_HEIGHT_PTS]);
        cursorY = A4_HEIGHT_PTS - MARGIN;
      }

      // Draw Header
      cursorY -= 14;
      page.drawText(`QUESTION ${questionNumber}`, {
        x: MARGIN,
        y: cursorY,
        size: 14,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
      cursorY -= 10;

      // Draw Note Image
      if (noteImage) {
        if (checkPageBreak(cursorY, noteDisplayHeight + SPACING.AFTER_TEXT)) {
          page = pdfDoc.addPage([A4_WIDTH_PTS, A4_HEIGHT_PTS]);
          cursorY = A4_HEIGHT_PTS - MARGIN;
        }

        cursorY -= noteDisplayHeight;
        page.drawImage(noteImage, {
          x: MARGIN,
          y: cursorY,
          width: noteDisplayWidth,
          height: noteDisplayHeight,
        });
        cursorY -= SPACING.AFTER_TEXT;
      }

      // Draw Image Rows
      for (const row of imageRows) {
        const requiredHeight = row.height + SPACING.AFTER_IMAGE;
        if (checkPageBreak(cursorY, requiredHeight)) {
          page = pdfDoc.addPage([A4_WIDTH_PTS, A4_HEIGHT_PTS]);
          cursorY = A4_HEIGHT_PTS - MARGIN;
        }

        let currentX = MARGIN + (USABLE_WIDTH - row.width) / 2;
        const rowY = cursorY - row.height;

        for (const imgData of row.images) {
          // Center vertically within the row if images have different heights
          const yOffset = (row.height - imgData.height) / 2;
          
          page.drawImage(imgData.imgObj, {
            x: currentX,
            y: rowY + yOffset,
            width: imgData.width,
            height: imgData.height,
          });

          // Border
          page.drawRectangle({
            x: currentX,
            y: rowY + yOffset,
            width: imgData.width,
            height: imgData.height,
            borderWidth: 0.5,
            borderColor: rgb(0.8, 0.8, 0.8),
            color: rgb(0, 0, 0),
            opacity: 0,
            borderOpacity: 1,
          });

          currentX += imgData.width + 10; // 10 is the GAP
        }
        cursorY -= row.height + SPACING.AFTER_IMAGE;
      }

      // Separator
      if (checkPageBreak(cursorY, 25)) {
        page = pdfDoc.addPage([A4_WIDTH_PTS, A4_HEIGHT_PTS]);
        cursorY = A4_HEIGHT_PTS - MARGIN;
      } else {
        cursorY -= 10;
        page.drawLine({
          start: { x: MARGIN, y: cursorY },
          end: { x: A4_WIDTH_PTS - MARGIN, y: cursorY },
          thickness: 0.5,
          color: rgb(0.7, 0.7, 0.7),
        });
        cursorY -= 10;
      }
    } catch (e) {
      console.error(`Skipping Question ${questionNumber} error:`, e);
    }
  }

  const pdfBytes = await pdfDoc.save();
  download(pdfBytes, `${name}.pdf`, "application/pdf");
};

export function evaluateBooleanQuery(query, evaluator) {
  if (!query || !query.trim()) return true;

  try {
    const quoteRegex = /(["'])(.*?)\1/g;

    let processedQuery = query.replace(
      quoteRegex,
      (match, quote, innerString) => {
        return evaluator(innerString) ? " true " : " false ";
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

export function evaluateTagQuery(query, questionTagNames) {
  const qTagsLower = questionTagNames.map((t) => t.toLowerCase());
  return evaluateBooleanQuery(query, (innerString) =>
    qTagsLower.includes(innerString.toLowerCase()),
  );
}

export function evaluateStringQuery(query, targetString) {
  const targetLower = (targetString || "").toLowerCase();
  return evaluateBooleanQuery(query, (innerString) =>
    targetLower.includes(innerString.toLowerCase()),
  );
}
