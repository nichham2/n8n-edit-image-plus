const sharp = require('sharp');
const fs = require('fs');

async function testFont(fontFamilyStr) {
    const safeStr = fontFamilyStr.replace(/"/g, '&quot;');
    const svg = `<svg width="400" height="100" xmlns="http://www.w3.org/2000/svg">
      <text x="10" y="50" font-family="${safeStr}" font-size="40" fill="black">Test</text>
    </svg>`;
    console.log(svg);
    const buf = await sharp(Buffer.from(svg)).png().toBuffer();
    console.log(`Rendered ` + fontFamilyStr);
}

async function run() {
    await testFont("Arial");
    await testFont("'Times New Roman'");
    await testFont('\"Times New Roman\"');
    await testFont("Times New Roman");
}
run();
