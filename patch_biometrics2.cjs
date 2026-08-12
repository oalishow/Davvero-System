const fs = require('fs');
let c = fs.readFileSync('src/components/StudentPortal.tsx', 'utf8');

const searchStr = `    } catch (e: any) {
      console.error(e);
      const errorMsg = e.message || "";`;

const replaceStr = `    } catch (e: any) {
      console.error(e);
      setIsGenerating(false);
      const errorMsg = e.message || "";`;

c = c.replace(searchStr, replaceStr);

fs.writeFileSync('src/components/StudentPortal.tsx', c);
