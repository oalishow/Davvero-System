try {
  require('@babel/parser').parse(require('fs').readFileSync('src/components/PublicAppointmentsList.tsx', 'utf8'), {sourceType: 'module', plugins: ['typescript', 'jsx']});
  console.log("No syntax errors");
} catch(e) {
  console.log(e.message);
}
