const db = require("../db/dbconfig");
const user = require("../db/users");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const saltRounds = 10;

const register = async (req, res) => {
    const userId = uuidv4();
    // TODO: Validate username and password
    const username = req.body.username;
    const password = req.body.password;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    console.log(password, hashedPassword);

    const query = {
        text: "INSERT INTO users (id, username, password) VALUES ($1, $2, $3)",
        values: [userId, username, hashedPassword],
    };

    // Make query
    db.query(query, (err, result) => {
        if (err) {
            return console.error("Error executing query", err.stack);
        }
    });

    res.sendStatus(200);
};

const login = async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    user.getUserByUsername(username, (user) => {
        if (user.length !== 1) res.sendStatus(400).end();
        const userId = user[0].id;
        const hashedPassword = user[0].password;

        if (bcrypt.compareSync(password, hashedPassword)) {
            jwt.sign(
                { userId: userId, username: username },
                process.env.JWT_SECRET,
                { expiresIn: "7d" },
                (err, result) => {
                    if (err) res.sendStatus(400).end();
                    else res.send({ result });
                }
            );
        } else {
            res.sendStatus(400).end();
        }
    });
};

module.exports = {
    register,
    login,
};
