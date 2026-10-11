
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve os arquivos HTML, CSS, JS e demais arquivos estáticos
app.use(express.static(__dirname));

app.get("/health", (req, res) => {
  res.json({ status: "ok", app: "Nichodevs" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Nichodevs rodando na porta ${PORT}`);
});
