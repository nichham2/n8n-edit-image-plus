const sharp = require('sharp');
const fs = require('fs');

async function testShadow() {
    const svgNoShadow = `<svg width="400" height="100" xmlns="http://www.w3.org/2000/svg">
      <text x="10" y="50" font-family="Arial" font-size="40" fill="black">No Shadow</text>
    </svg>`;
    
    const svgShadow = `<svg width="400" height="100" xmlns="http://www.w3.org/2000/svg">
      <defs><filter id="ts"><feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.6"/></filter></defs>
      <text x="10" y="50" font-family="Arial" font-size="40" fill="black" filter="url(#ts)">Shadow</text>
    </svg>`;

    try {
        await sharp(Buffer.from(svgNoShadow)).png().toBuffer();
        console.log("No shadow rendered OK");
    } catch(e) { console.log("No shadow failed", e); }

    try {
        await sharp(Buffer.from(svgShadow)).png().toBuffer();
        console.log("Shadow rendered OK");
    } catch(e) { console.log("Shadow failed", e); }
}

testShadow();
