import { createWorker } from 'tesseract.js';
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined. Please set it in the Secrets panel.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export async function performOCR(imageFile: File, onProgress: (progress: number) => void, retries = 2): Promise<string> {
  try {
    const ai = getAI();
    onProgress(0.05);
    
    const compressedBase64 = await compressImage(imageFile, 1600); 
    onProgress(0.15);
    
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview", // Upgraded to Pro for maximum accuracy
      contents: [
        {
          parts: [
            { text: "Output ONLY the text contained in this image. Maintain the original structure. If it is Bengali, be extremely precise with joints and characters." },
            { 
              inlineData: { 
                mimeType: "image/jpeg", 
                data: compressedBase64.split(',')[1] 
              } 
            }
          ]
        }
      ],
      // Note: ThinkingLevel is not available for gemini-3.1-pro-preview per documentation
    });
    
    onProgress(1);
    return response.text || "";
  } catch (error) {
    console.error(`OCR Attempt failed (${retries} retries left):`, error);
    if (retries > 0) {
      return performOCR(imageFile, onProgress, retries - 1);
    }
    // Final fallback to local Tesseract if AI fails completely (network/quota issues)
    return performTesseractOCR(imageFile, onProgress);
  }
}

async function compressImage(file: File, maxDimension: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height *= maxDimension / width;
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width *= maxDimension / height;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8)); // Compress as JPEG with 80% quality
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

async function performTesseractOCR(image: File, onProgress: (progress: number) => void) {
  const worker = await createWorker('eng+ben', 1, {
    logger: m => {
      if (m.status === 'recognizing text') {
        onProgress(m.progress);
      }
    }
  });
  
  const { data: { text } } = await worker.recognize(image);
  await worker.terminate();
  return text;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}
