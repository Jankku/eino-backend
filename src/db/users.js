const db = require("./dbconfig");

const getUserByUsername = (username, next) => {
    const query = {
        text: "SELECT * FROM users WHERE username = $1",
        values: [username],
    };

    db.query(query, (err, result) => {
        if (err) {
            return console.error("Error executing query", err.stack);
        } else {
            next(result.rows);
        }
    });
};

module.exports = {
    getUserByUsername,
};
