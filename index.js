import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.sendFile(`${__dirname}/index.html`)
})

app.listen(port, () => {
    console.log('server is running on port:', port)
})