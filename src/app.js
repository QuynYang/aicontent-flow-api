const express = require('express');
const dotenv = require('dotenv');

// Load biến môi trường
dotenv.config();

const app = express();
app.use(express.json());

// Test Route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'AICONTENT-FLOW Core API is running!' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`Clean Architecture structure is ready.`);
});