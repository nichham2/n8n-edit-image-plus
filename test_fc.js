const { execSync } = require('child_process');
try {
    const out = execSync('fc-list --format="%{family}\\n" | head -n 10');
    console.log(out.toString());
} catch(e) { console.log("Not available on Windows"); }
