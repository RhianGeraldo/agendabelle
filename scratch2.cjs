const { parse, differenceInDays, addDays, format } = require('date-fns');

const dtInicio = '14/04/2026';
const dtFim = '14/08/2026';

const start = parse(dtInicio, 'dd/MM/yyyy', new Date());
const end = parse(dtFim, 'dd/MM/yyyy', new Date());

let currentStart = start;
while (currentStart <= end) {
  let currentEnd = addDays(currentStart, 30);
  if (currentEnd > end) {
    currentEnd = end;
  }
  const chunkStartStr = format(currentStart, 'dd/MM/yyyy');
  const chunkEndStr = format(currentEnd, 'dd/MM/yyyy');
  
  console.log(`dtInicio=${chunkStartStr}&dtFim=${chunkEndStr}`);
  
  currentStart = addDays(currentEnd, 1);
}
