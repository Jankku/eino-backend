/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable import/no-extraneous-dependencies */
import chai from 'chai';
import chaiHttp from 'chai-http';
import app from '../src/app';
import { deleteAllUsers } from '../src/db/users';

chai.use(chaiHttp);

const should = chai.should();

const user = {
  username: 'testuser',
  password: 'testpassword123',
};

describe('Register', () => {
  beforeEach(() => {
    deleteAllUsers();
  });

  // TODO: test with too short/long username/password

  it('Successfully register new user', (done) => {
    chai.request(app)
      .post('/auth/register')
      .send(user)
      .end((err, res) => {
        res.should.have.status(200);
        res.body.should.be.a('object');
        res.body.should.have.property('result');
        res.body.result.should.have.property('code');
        res.body.result.should.have.property('message').eql(user.username);
        done();
      });
  });
});

describe('Login', () => {
  // TODO: test with invalid tokens

  it('Successfully login user', (done) => {
    chai
      .request(app)
      .post('/auth/login')
      .send(user)
      .end((err, res) => {
        res.should.have.status(200);
        res.body.should.be.a('object');
        res.body.should.have.property('token');
        done();
      });
  });
});
