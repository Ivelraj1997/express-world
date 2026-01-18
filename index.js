const express = require('express');
const app = express();
const port = 3000;

// Middleware to log requests (useful for debugging on EC2)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// The "Hello World" Route
app.get('/', (req, res) => {
  res.send('<h1>Hello World!</h1><p>Express is running on AWS EC2.</p>');
});

// Health check route (standard practice for AWS Load Balancers)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(port, () => {
  console.log(`Server is successfully running at http://localhost:${port}`);
});