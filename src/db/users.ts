import query from './dbconfig';

const getUserByUsername = (username: string, next: Function) => {
  const q: any = {
    text: 'SELECT * FROM users WHERE username = $1',
    values: [username],
  };

  query(q, (err: any, result: any) => {
    if (err) return console.error('Error executing query', err.stack);
    next(result.rows);
  });
};

export default getUserByUsername;
