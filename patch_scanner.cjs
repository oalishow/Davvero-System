const fs = require('fs');
let c = fs.readFileSync('src/components/Verifier.tsx', 'utf8');

const searchStr = `                }
                setIsScanning(false);
              });
          }).catch((err: any) => {
            console.error("Error getting cameras", err);`;

const replaceStr = `                }
                setIsScanning(false);
              });
          })
          .catch((err: any) => {
            console.error("Scanner: Camera start error:", err);
            if (
              err?.toString().includes("NotAllowedError") ||
              err?.toString().includes("Permission")
            ) {
              showAlert("Permissão de câmera negada. É necessário autorizar a câmera para escanear QR Codes.", { type: "error" });
            } else if (err?.toString().includes("NotFoundError")) {
              showAlert("Nenhuma câmera encontrada neste dispositivo.", { type: "error" });
            }
            setIsScanning(false);
          });
        }).catch((err) => {
          console.error("Failed to load html5-qrcode module", err);
          showAlert("Não foi possível carregar o módulo da câmera. Verifique sua conexão.", { type: "error" });
          setIsScanning(false);
        });
      }, 300);`;

// Wait, the searchStr above is wrong. I need to be precise.
