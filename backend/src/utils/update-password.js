const express = require("express");
const router = express.Router();
const db = require("./database");

router.post("/update-password", (req, res) => {
    const { id, name, password } = req.body;

    if (!id || !name)
        return res.status(400).json({ message: "Dados incompletos." });

    if (!password || password.trim() === "") {
        db.run(
            `UPDATE users SET name = ? WHERE id = ?`,
            [name, id],
            function (err) {
                if (err) return res.status(500).json({ message: "Erro ao atualizar nome." });
                return res.json({ message: "Nome atualizado." });
            }
        );
        return;
    }

    db.run(
        `UPDATE users SET name = ?, password = ? WHERE id = ?`,
        [name, password, id],
        function (err) {
            if (err) return res.status(500).json({ message: "Erro ao atualizar password." });
            return res.json({ message: "Conta atualizada." });
        }
    );
});

module.exports = router;
