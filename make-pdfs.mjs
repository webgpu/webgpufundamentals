import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';

const BASE_URL = 'http://localhost:8080'; // Your local 'servez' URL

async function generateTutorialPdf() {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  console.log('Finding lesson links...');
  await page.goto(BASE_URL);

  // Scrape all links that look like lessons
  const lessonLinks = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href*="/lessons/"]'));
    return anchors
      .map(a => a.href)
      .filter(href => href.endsWith('.html'));
  });

  // Remove duplicates
  const uniqueLinks = [...new Set(lessonLinks)];
  console.log(`Found ${uniqueLinks.length} lessons. Starting conversion...`);

  const mergedPdf = await PDFDocument.create();

  for (const link of uniqueLinks) {
    console.log(`Processing: ${link}`);
    await page.goto(link, { waitUntil: 'networkidle0' });
    
    // Optional: Hide the navbar/UI elements for a cleaner PDF
    await page.addStyleTag({ content: '.webgpu_navbar, #forkongithub { display: none !important; }' });

    const pdfBytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' }
    });

    const doc = await PDFDocument.load(pdfBytes);
    const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
    copiedPages.forEach((p) => mergedPdf.addPage(p));
  }

  const mergedPdfBytes = await mergedPdf.save();
  fs.writeFileSync('WebGPU_Fundamentals_Full.pdf', mergedPdfBytes);
  
  console.log('Done! Created WebGPU_Fundamentals_Full.pdf');
  await browser.close();
}

generateTutorialPdf().catch(console.error);

