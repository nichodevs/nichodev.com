
const express = require("express");
const path = require("node:path");

const app = express();
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Nichodevs',
    message: 'API conectada com sucesso!'
  });
});
const PORT = process.env.PORT || 3000;

// Serve apenas os arquivos públicos do site.
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
  res.json({ status: "ok", app: "Nichodevs" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Nichodevs rodando na porta ${PORT}`);
});
