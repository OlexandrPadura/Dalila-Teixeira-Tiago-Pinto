const fs = require('fs');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const words = content.toLowerCase().match(/\b\w+\b/g) || [];
  const wordCount = {};

  words.forEach((word) => {
    if (word.length > 1) {
      wordCount[word] = (wordCount[word] || 0) + 1;
    }
  });

  return wordCount;
}

if (!isMainThread) {
  const wordCount = processFile(workerData.filePath);
  parentPort.postMessage(wordCount);
}

if (isMainThread) {
  const directoryPath = path.join(__dirname, 'texts');
  const outputFile = path.join(__dirname, 'result.txt');

  fs.readdir(directoryPath, (err, files) => {
    if (err) throw err;

    const workers = [];
    const wordCounts = {};

    files.forEach((file) => {
      const filePath = path.join(directoryPath, file);
      const worker = new Worker(__filename, { workerData: { filePath } });
      workers.push(worker);

      worker.on('message', (data) => {
        Object.entries(data).forEach(([word, count]) => {
          wordCounts[word] = (wordCounts[word] || 0) + count;
        });
      });

      worker.on('error', (err) => {
        console.error(`Worker error: ${err}`);
      });

      worker.on('exit', () => {
        if (workers.every((worker) => worker.threadId === -1)) {
          const sortedWords = Object.entries(wordCounts)
            .filter(([, count]) => count > 1)
            .sort(([, countA], [, countB]) => countB - countA);

          const maxFrequency = sortedWords[0][1];

          const fontSize = (count) => {
            if (count === maxFrequency) return 'Huge';
            if (count > 0.6 * maxFrequency) return 'Big';
            if (count > 0.3 * maxFrequency) return 'Normal';
            return 'Small';
          };

          const outputLines = sortedWords.map(([word, count]) => {
            return `${word} - ${count} - ${fontSize(count)}`;
          });

          fs.writeFileSync(outputFile, outputLines.join('\n'));
          console.log(`Word cloud saved to ${outputFile}`);
        }
      });
    });
  });
}
