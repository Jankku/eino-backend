import { hash, compareSync } from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { sign } from 'jsonwebtoken';
import { Request, Response } from 'express';
import getUserByUsername from '../db/users';
import query from '../db/dbconfig';
import User from '../db/model/user';

const saltRounds = 10;

const register = async (req: Request, res: Response) => {
  const userId = uuidv4();
  // TODO: Validate username and password
  const { username } = req.body;
  const { password } = req.body;

  try {
    const hashedPassword = await hash(password, saltRounds);

    const q: any = {
      text: 'INSERT INTO users (id, username, password) VALUES ($1, $2, $3)',
      values: [userId, username, hashedPassword],
    };

    console.log(q);

    query(q, (err: any) => {
      if (err) {
        console.error('Error executing query', err.stack);
        res.sendStatus(400);
      } else {
        res.sendStatus(200);
      }
    });
  } catch (error) {
    console.log(`Error: ${error}`);
  }
};

const login = async (req: Request, res: Response) => {
  const { username } = req.body;
  const { password } = req.body;

  try {
    getUserByUsername(username, (user: User[]) => {
      if (user.length !== 1) res.sendStatus(400).end();
      const userId = user[0].id;
      const hashedPassword = user[0].password;

      if (!compareSync(password, hashedPassword)) { return res.sendStatus(400).end(); }

      sign(
        { userId, username },
        `${process.env.JWT_SECRET}`,
        { expiresIn: '7d' },
        (err, result) => {
          if (err) res.sendStatus(400).end();
          else res.send({ result });
        },
      );
    });
  } catch (error) {
    console.log(`Error: ${error}`);
  }
};

export default {
  register,
  login,
};
