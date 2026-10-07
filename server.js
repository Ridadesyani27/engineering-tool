require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const auth = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));

// Entra SSO gate — everything registered after this point requires a signed-in
// N-Sea account, static assets included.
auth.install(app);

app.use(express.static(path.join(__dirname, 'public')));

// Ensure pdf directory exists
const pdfDir = path.join(__dirname, 'pdf');
if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

app.use('/', require('./routes/index'));
app.use('/', require('./routes/catenary'));
app.use('/', require('./routes/reel'));
app.use('/', require('./routes/tensioner'));
app.use('/', require('./routes/carousel'));

app.listen(PORT, () => {
  console.log(`N-Sea Engineering Tools running at http://localhost:${PORT}`);
});
