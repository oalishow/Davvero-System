const fs = require('fs');
let c = fs.readFileSync('src/components/Verifier.tsx', 'utf8');

const searchStr = `              .catch(() => setIsScanning(false));
          });
        });
      }, 500);`;

const replaceStr = `              .catch(() => setIsScanning(false));
          });
        }).catch((err) => {
          console.error("Failed to load html5-qrcode module", err);
          showAlert("Não foi possível carregar o módulo da câmera. Verifique sua conexão.", { type: "error" });
          setIsScanning(false);
        });
      }, 500);`;

c = c.replace(searchStr, replaceStr);

fs.writeFileSync('src/components/Verifier.tsx', c);
