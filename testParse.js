const lines = `*Orientação Espiritual - Padre Alan*

*AGOSTO*


*10/08 (Segunda-feira)*

15h: Alexandre 
16h:  Igor

*11/08 (Terça-feira)*
14h: Paulo
15h: Ferreira 
16h: Giovane
17h: Leonardo

*13/08 (Quinta-feira)*

15h:  Marcos Giovane 
16h: Rafael 
17h: Brendon 

*17/08(segunda-feira)*

15h: Gabriel Danelon 
16h:Vinicius Agnelli 

*18/08 (terça -feira)*
14h: José Eduardo 
15h:  Wagner 
16h: Jhonatas 
17h: Marcos H.

*20/08(quinta-feira)*

15h: Gabriel R
16h: Gustavo 
17h: João Pedro 
*24/08(segunda-feira)*

15h: Carlos Eduardo 
16h: Emanuel 

*25/08 (terça -feira)*
14h: Elian Ortiz 
15h: Luan
16h: Adrian Miguel
17h: Antônio 

*27/08 (quinta-feira)*

15h: Valencio
16h: Maicon Luis 
17h: José Fabrício 

*31/08 (segunda-feira)*

15h: Alison
16h: Guilherme`.split('\n');

let currentDate = null;
const slots = [];
const currentYear = new Date().getFullYear();
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      // Try to find a date like DD/MM (string) or DD/MM/YYYY
      const dateMatch = line.match(/(?:^|\s|\*|-|_)(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
      if (dateMatch && !line.match(/^(\d{1,2})(?:h|:00)?/i)) {
        const day = dateMatch[1].padStart(2, '0');
        const month = dateMatch[2].padStart(2, '0');
        const year = dateMatch[3] ? (dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]) : currentYear.toString();
        currentDate = `${year}-${month}-${day}`;
        continue;
      }
      // Try to find time and name like 14h: Name, 14:00 - Name
      const timeMatch = line.match(/^(\d{1,2})(?:h|:00)?\s*(?::|-|–)?\s*(.*)$/i);
      if (timeMatch && currentDate) {
        const hour = timeMatch[1].padStart(2, '0');
        const timeStr = `${hour}:00`;
        const rawName = timeMatch[2]?.trim() || "";
        slots.push({ currentDate, timeStr, rawName });
      }
    }
console.log(slots);
