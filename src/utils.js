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

// Helper to check if an item fits (simple check for now, full logic will be in main loop)
const doesItemFit = (currentCursorY, itemHeight, minimumMargin) => {
  return currentCursorY - itemHeight >= minimumMargin;
};

// Helper function to draw content currently in currentPageItems and clear it
const drawPageContent = (pageToDrawOn, itemsToDraw, initialCursorY, CURRENT_MARGIN, CURRENT_IMAGE_GAP, CURRENT_USABLE_WIDTH, CURRENT_AFTER_TEXT, CURRENT_AFTER_IMAGE, fontBold, fontItalic) => {
    let currentDrawingY = initialCursorY;
    for (const item of itemsToDraw) {
        if (item.type === 'header') {
            currentDrawingY -= (item.height - 10); // Adjust for the padding above header text
            pageToDrawOn.drawText(`QUESTION ${item.number}`, {
                x: CURRENT_MARGIN,
                y: currentDrawingY,
                size: 14,
                font: fontBold,
                color: rgb(0, 0, 0),
            });
            if (item.tagNames) {
                const headerWidth = fontBold.widthOfTextAtSize(`QUESTION ${item.number}`, 14);
                pageToDrawOn.drawText(` [${item.tagNames}]`, {
                    x: CURRENT_MARGIN + headerWidth,
                    y: currentDrawingY,
                    size: 9,
                    font: fontItalic,
                    color: rgb(0.3, 0.3, 0.3),
                });
            }
            currentDrawingY -= 10; // Space below header
        } else if (item.type === 'note') {
            currentDrawingY -= item.height;
            pageToDrawOn.drawImage(item.imgObj, {
                x: CURRENT_MARGIN,
                y: currentDrawingY,
                width: item.width,
                height: item.height,
            });
            currentDrawingY -= CURRENT_AFTER_TEXT;
        } else if (item.type === 'imageRow') {
            let currentX = CURRENT_MARGIN + (CURRENT_USABLE_WIDTH - item.width) / 2;
            const rowY = currentDrawingY - item.height;

            for (const imgData of item.images) {
                const yOffset = (item.height - imgData.height) / 2;
                pageToDrawOn.drawImage(imgData.imgObj, {
                    x: currentX,
                    y: rowY + yOffset,
                    width: imgData.width,
                    height: imgData.height,
                });
                pageToDrawOn.drawRectangle({
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
                currentX += imgData.width + CURRENT_IMAGE_GAP;
            }
            currentDrawingY -= item.height + CURRENT_AFTER_IMAGE;
        }
    }
    return currentDrawingY;
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

  const { includeNotes, includeTags, tags, isCompact } = options;

  const CURRENT_MARGIN = isCompact ? 10 : 20;
  const CURRENT_USABLE_WIDTH = A4_WIDTH_PTS - 2 * CURRENT_MARGIN;
  const CURRENT_AFTER_TEXT = isCompact ? 8 : 15;
  const CURRENT_AFTER_IMAGE = isCompact ? 3 : 5;
  const CURRENT_SEPARATOR_VERTICAL_SPACE = isCompact ? 10 : 20;
  const CURRENT_IMAGE_GAP = isCompact ? 5 : 10;
  const CURRENT_MAX_IMAGE_HEIGHT_FACTOR = 0.45; 
  const MAX_IMAGE_HEIGHT_PER_PAGE = (A4_HEIGHT_PTS - 2 * CURRENT_MARGIN) * CURRENT_MAX_IMAGE_HEIGHT_FACTOR;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Courier);
  const fontBold = await pdfDoc.embedFont(StandardFonts.CourierBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.CourierOblique);

  let page = pdfDoc.addPage([A4_WIDTH_PTS, A4_HEIGHT_PTS]);
  let cursorY = A4_HEIGHT_PTS - CURRENT_MARGIN;
  let currentPageItems = []; // Items to be drawn on the current page, including header

  for (let index = 0; index < questions.length; index++) {
    const question = questions[index];
    const questionNumber = index + 1;

    try {
      // Get tag names for this question
      const tagNames = (question.tags || [])
        .map((tagId) => (tags || []).find((t) => t.id === tagId)?.name)
        .filter(Boolean)
        .join(", ");

      const questionHeaderItem = { 
          type: 'header', 
          height: 14 + 10, // Font size + padding
          number: questionNumber, 
          tagNames: includeTags ? tagNames : null // Only include tagNames if includeTags is true
      };
      
      const questionContent = []; // Will store images and notes for this question

      if (includeNotes && question.note) {
        const noteDataUrl = await renderNoteToImage(question.note);
        if (noteDataUrl) {
          const notePdfImage = await safeEmbedImage(pdfDoc, noteDataUrl);
          if (notePdfImage) {
            const { width, height } = notePdfImage;
            const scaleFactor = CURRENT_USABLE_WIDTH / width;
            const noteDisplayWidth = CURRENT_USABLE_WIDTH;
            const noteDisplayHeight = height * scaleFactor;
            questionContent.push({
              type: 'note',
              imgObj: notePdfImage,
              width: noteDisplayWidth,
              height: noteDisplayHeight,
              originalWidth: width,
              originalHeight: height,
            });
          }
        }
      }

      if (question.images && question.images.length > 0) {
        let currentRowImages = [];
        let currentRowWidth = 0;
        let currentRowMaxHeight = 0;

        for (const imageUrl of question.images) {
          if (!imageUrl) continue;
          const pdfImage = await safeEmbedImage(pdfDoc, imageUrl);
          if (!pdfImage) continue;

          const { width, height } = pdfImage;
          let scaleFactor = 1.0;
          const MAX_IMAGE_HEIGHT_PER_PAGE = (A4_HEIGHT_PTS - 2 * CURRENT_MARGIN) * CURRENT_MAX_IMAGE_HEIGHT_FACTOR;

          if (width > CURRENT_USABLE_WIDTH) {
            scaleFactor = CURRENT_USABLE_WIDTH / width;
          }
          if (height * scaleFactor > MAX_IMAGE_HEIGHT_PER_PAGE) {
            scaleFactor = MAX_IMAGE_HEIGHT_PER_PAGE / height;
          }

          const imgDisplayWidth = width * scaleFactor;
          const imgDisplayHeight = height * scaleFactor;
          
          const imgData = { 
            type: 'image',
            imgObj: pdfImage, 
            width: imgDisplayWidth, 
            height: imgDisplayHeight, 
            originalWidth: width,
            originalHeight: height,
            scaleFactor: scaleFactor
          };

          const isHeavilyScaled = scaleFactor < 0.7; 
          const canFitInRow = !isHeavilyScaled && 
                             (currentRowWidth + CURRENT_IMAGE_GAP + imgDisplayWidth) <= CURRENT_USABLE_WIDTH && 
                             imgDisplayWidth < CURRENT_USABLE_WIDTH * 0.5;

          if (currentRowImages.length > 0 && canFitInRow) {
            currentRowImages.push(imgData);
            currentRowWidth += CURRENT_IMAGE_GAP + imgDisplayWidth;
            currentRowMaxHeight = Math.max(currentRowMaxHeight, imgDisplayHeight);
          } else {
            if (currentRowImages.length > 0) {
                questionContent.push({
                    type: 'imageRow',
                    images: currentRowImages,
                    width: currentRowWidth,
                    height: currentRowMaxHeight,
                });
            }
            currentRowImages = [imgData];
            currentRowWidth = imgDisplayWidth;
            currentRowMaxHeight = imgDisplayHeight;
          }
        }
        if (currentRowImages.length > 0) {
            questionContent.push({
                type: 'imageRow',
                images: currentRowImages,
                width: currentRowWidth,
                height: currentRowMaxHeight,
            });
        }
      }

      // --- Drawing Loop with Page Break Optimization ---

      // Consider header for current page
      let requiredHeightForHeader = questionHeaderItem.height + 10; // +10 for space below header
      if (!doesItemFit(cursorY, requiredHeightForHeader, CURRENT_MARGIN)) {
          // If header alone doesn't fit, draw existing content and new page
          cursorY = drawPageContent(page, currentPageItems, cursorY, CURRENT_MARGIN, CURRENT_IMAGE_GAP, CURRENT_USABLE_WIDTH, CURRENT_AFTER_TEXT, CURRENT_AFTER_IMAGE, fontBold, fontItalic);
          page = pdfDoc.addPage([A4_WIDTH_PTS, A4_HEIGHT_PTS]);
          cursorY = A4_HEIGHT_PTS - CURRENT_MARGIN;
          currentPageItems = [];
      }
      currentPageItems.push(questionHeaderItem);
      
      for (const item of questionContent) {
          let requiredHeightForItem = 0;
          if (item.type === 'note') {
              requiredHeightForItem = item.height + CURRENT_AFTER_TEXT;
          } else if (item.type === 'imageRow') {
              requiredHeightForItem = item.height + CURRENT_AFTER_IMAGE;
          }

          // Check if current item fits on the current page
          if (!doesItemFit(cursorY - currentPageItems.reduce((sum, ci) => { // Calculate height of items currently in buffer
                if (ci.type === 'header') return sum + ci.height + 10;
                if (ci.type === 'note') return sum + ci.height + CURRENT_AFTER_TEXT;
                if (ci.type === 'imageRow') return sum + ci.height + CURRENT_AFTER_IMAGE;
                return sum;
             }, 0), requiredHeightForItem, CURRENT_MARGIN)) {
              
              // It doesn't fit, so attempt optimization if compact mode is enabled
              if (isCompact && currentPageItems.some(ci => ci.type === 'imageRow')) {
                  // Calculate available space on current page
                  let occupiedHeight = (A4_HEIGHT_PTS - CURRENT_MARGIN) - cursorY;
                  let spaceRemainingForContent = cursorY - CURRENT_MARGIN;

                  let currentContentHeightInConsideration = currentPageItems.reduce((sum, ci) => {
                      if (ci.type === 'header') return sum + ci.height + 10;
                      if (ci.type === 'note') return sum + ci.height + CURRENT_AFTER_TEXT;
                      if (ci.type === 'imageRow') return sum + ci.height + CURRENT_AFTER_IMAGE;
                      return sum;
                  }, 0);
                  
                  let totalAdjustableHeight = 0;
                  const adjustableImageItems = currentPageItems.filter(ci => ci.type === 'imageRow');
                  
                  if (adjustableImageItems.length > 0) {
                      // Sum current heights of adjustable images (excluding AFTER_IMAGE padding)
                      totalAdjustableHeight = adjustableImageItems.reduce((sum, imgRow) => sum + imgRow.height, 0);

                      if (totalAdjustableHeight > 0) {
                          // The amount of "extra" space we have (or deficit) to adjust for
                          const availableExpansionSpace = spaceRemainingForContent - (currentContentHeightInConsideration + requiredHeightForItem);
                          
                          // If there's positive available space to fill
                          if (availableExpansionSpace > 0) {
                              const expansionRatio = (totalAdjustableHeight + availableExpansionSpace) / totalAdjustableHeight;

                              // Apply scaling to each image row
                              for (const imgRow of adjustableImageItems) {
                                  let newRowHeight = imgRow.height * expansionRatio;
                                  // Ensure we don't scale images beyond their original resolution or MAX_IMAGE_HEIGHT_PER_PAGE
                                  // This is a simplified check. A more robust solution would iterate imgRow.images
                                  // and calculate max possible scale-up without exceeding original res or MAX_HEIGHT_PER_PAGE
                                  let maxPossibleRowHeight = 0;
                                  for(const individualImg of imgRow.images){
                                      const maxIndividualHeight = Math.min(individualImg.originalHeight, MAX_IMAGE_HEIGHT_PER_PAGE / individualImg.scaleFactor);
                                      maxPossibleRowHeight = Math.max(maxPossibleRowHeight, maxIndividualHeight);
                                  }
                                  
                                  newRowHeight = Math.min(newRowHeight, maxPossibleRowHeight); // Clamp to max possible height

                                  if (newRowHeight > imgRow.height) { // Only adjust if increasing
                                      const rowScaleFactor = newRowHeight / imgRow.height;
                                      imgRow.height = newRowHeight;
                                      // Proportional adjustment of individual images in the row
                                      imgRow.images.forEach(img => {
                                          img.width *= rowScaleFactor;
                                          img.height *= rowScaleFactor;
                                      });
                                  }
                              }
                          }
                      }
                  }
              }
              
              // Draw content on current page
              cursorY = drawPageContent(page, currentPageItems, cursorY, CURRENT_MARGIN, CURRENT_IMAGE_GAP, CURRENT_USABLE_WIDTH, CURRENT_AFTER_TEXT, CURRENT_AFTER_IMAGE, fontBold, fontItalic);
              // Start a new page
              page = pdfDoc.addPage([A4_WIDTH_PTS, A4_HEIGHT_PTS]);
              cursorY = A4_HEIGHT_PTS - CURRENT_MARGIN;
              currentPageItems = [];
          }
          currentPageItems.push(item);
      }
      
      // Draw any remaining items for this question on the current page
      cursorY = drawPageContent(page, currentPageItems, cursorY, CURRENT_MARGIN, CURRENT_IMAGE_GAP, CURRENT_USABLE_WIDTH, CURRENT_AFTER_TEXT, CURRENT_AFTER_IMAGE, fontBold, fontItalic);
      currentPageItems = []; // Clear for next question

      // Separator after each question
      if (!doesItemFit(cursorY, CURRENT_SEPARATOR_VERTICAL_SPACE + 5, CURRENT_MARGIN)) {
          page = pdfDoc.addPage([A4_WIDTH_PTS, A4_HEIGHT_PTS]);
          cursorY = A4_HEIGHT_PTS - CURRENT_MARGIN;
      } else {
          cursorY -= (CURRENT_SEPARATOR_VERTICAL_SPACE / 2);
          page.drawLine({
              start: { x: CURRENT_MARGIN, y: cursorY },
              end: { x: A4_WIDTH_PTS - CURRENT_MARGIN, y: cursorY },
              thickness: 0.5,
              color: rgb(0.7, 0.7, 0.7),
          });
          cursorY -= (CURRENT_SEPARATOR_VERTICAL_SPACE / 2);
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
