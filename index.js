const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 5000;

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Endpoint to list quizzes
app.get('/api/list-quizzes', (req, res) => {
  const quizDirectory = path.join(__dirname, 'public', 'list quizzes');
  const folder = req.query.folder || '';
  const currentPath = path.join(quizDirectory, folder);

  fs.readdir(currentPath, { withFileTypes: true }, (err, entries) => {
    if (err) {
      console.error('Error reading directory:', err);
      return res.status(500).send('Error reading directory');
    }

    const result = {
      folders: entries.filter(entry => entry.isDirectory()).map(entry => entry.name),
      files: entries.filter(entry => entry.isFile() && entry.name.endsWith('.txt')).map(entry => entry.name)
    };
    res.json(result);
  });
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
});