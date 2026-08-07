const lines = [
  "*10/08 (Segunda-feira)*",
  "15h: Alexandre",
  "16h:  Igor",
  "*11/08 (Terça-feira)*",
  "14h: Paulo"
];

for (let line of lines) {
  let dateMatch = line.match(/(?:^|\s|\*|-|_)(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  console.log("dateMatch for", line, ":", dateMatch ? [dateMatch[1], dateMatch[2], dateMatch[3]] : false);
  
}
