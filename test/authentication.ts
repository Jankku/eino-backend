/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable import/no-extraneous-dependencies */
import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import app from '../src/app';
import { deleteAllUsers } from '../src/db/users';
import { ResponseItem } from '../src/util/response';

const should = chai.should();

chai.use(chaiHttp);

// Register tests
describe('Register', () => {
  beforeEach(() => {
    deleteAllUsers();
  });

  it('Shouldnt register new user when password is empty', (done) => {
    const user = {
      username: 'testuser',
      password: '',
    };

    chai.request(app)
      .post('/api/auth/register')
      .send(user)
      .end((err, res) => {
        res.should.have.status(422);
        res.body.should.be.a('object');
        res.body.should.have.property('errors');
        res.body.errors.should.be.a('array');
        expect(res.body.errors.map((e: ResponseItem) => e.code)).to.include('password_length_invalid');
        done();
      });
  });

  it('Shouldnt register new user when password is too short', (done) => {
    const user = {
      username: 'testuser',
      password: 'test',
    };

    chai.request(app)
      .post('/api/auth/register')
      .send(user)
      .end((err, res) => {
        res.should.have.status(422);
        res.body.should.be.a('object');
        res.body.should.have.property('errors');
        res.body.errors.should.be.a('array');
        expect(res.body.errors.map((e: ResponseItem) => e.code)).to.include('password_length_invalid');
        done();
      });
  });

  it('Shouldnt register new user when password is too long', (done) => {
    const user = {
      username: 'testuser',
      password: 'hnyf7RrvPBYUqgLp4KCcVG9TRgdCgGubTzShukasduu3i47237riuiuiug3r25CQj9enJMqdtVgHDjfDq8e4eL9n2UvQTKKLgtp2t5Tjbkth7pFQ7dBKqY6m99BLePn8Y799zzhFLBdRL9a7PJSpUqCRV3W5FGgkvnmsbwsVEQjvca6XRfPbPD3QEWnjV6y2As9aYccqXMbewSfJ4ALYzx7heCEmJ6CyGFgqyTnKnWMJs3rtksxsYbkUXxPckGA8tzFhGZgsre9vuct62uCR9cwS8ajshjasjd2312312',
    };

    chai.request(app)
      .post('/api/auth/register')
      .send(user)
      .end((err, res) => {
        res.should.have.status(422);
        res.body.should.be.a('object');
        res.body.should.have.property('errors');
        res.body.errors.should.be.a('array');
        expect(res.body.errors.map((e: ResponseItem) => e.code)).to.include('password_length_invalid');
        done();
      });
  });

  it('Shouldnt register new user when username is empty', (done) => {
    const user = {
      username: '',
      password: 'testpassword123',
    };

    chai.request(app)
      .post('/api/auth/register')
      .send(user)
      .end((err, res) => {
        res.should.have.status(422);
        res.body.should.be.a('object');
        res.body.should.have.property('errors');
        res.body.errors.should.be.a('array');
        expect(res.body.errors.map((e: ResponseItem) => e.code)).to.include('username_length_invalid');
        done();
      });
  });

  it('Shouldnt register new user when username is too short', (done) => {
    const user = {
      username: 'te',
      password: 'testpassword123',
    };

    chai.request(app)
      .post('/api/auth/register')
      .send(user)
      .end((err, res) => {
        res.should.have.status(422);
        res.body.should.be.a('object');
        res.body.should.have.property('errors');
        res.body.errors.should.be.a('array');
        expect(res.body.errors.map((e: ResponseItem) => e.code)).to.include('username_length_invalid');
        done();
      });
  });

  it('Shouldnt register new user when username is too long', (done) => {
    const user = {
      username: 'hnyf7RrvPBYUqgLp4KCcVG9TRgdCgGubTzShukasduu3i47237riuiuiug3r25CQj9enJMqdtVgHDjfDq8e4eL9n2UvQTKKLgtp2t5Tjbkth7pFQ7dBKqY6m99BLePn8Y799zzhFLBdRL9a7PJSpUqCRV3W5FGgkvnmsbwsVEQjvca6XRfPbPD3QEWnjV6y2As9aYccqXMbewSfJ4ALYzx7heCEmJ6CyGFgqyTnKnWMJs3rtksxsYbkUXxPckGA8tzFhGZgsre9vuct62uCR9cwS8ajshjasjd2312312',
      password: 'testpassword123',
    };

    chai.request(app)
      .post('/api/auth/register')
      .send(user)
      .end((err, res) => {
        res.should.have.status(422);
        res.body.should.be.a('object');
        res.body.should.have.property('errors');
        res.body.errors.should.be.a('array');
        expect(res.body.errors.map((e: ResponseItem) => e.code)).to.include('username_length_invalid');
        done();
      });
  });

  it('Should register new user when username is minimum length', (done) => {
    const user = {
      username: 'tes',
      password: 'testpassword123',
    };

    chai.request(app)
      .post('/api/auth/register')
      .send(user)
      .end((err, res) => {
        res.should.have.status(200);
        res.body.should.be.a('object');
        res.body.should.have.property('result');
        res.body.result.should.be.a('object');
        res.body.result.should.have.property('code').eql('user_registered');
        res.body.result.should.have.property('message').eql(user.username);
        done();
      });
  });

  it('Should register new user when password is minimum length', (done) => {
    const user = {
      username: 'testuser',
      password: 'testuser',
    };

    chai.request(app)
      .post('/api/auth/register')
      .send(user)
      .end((err, res) => {
        res.should.have.status(200);
        res.body.should.be.a('object');
        res.body.should.have.property('result');
        res.body.result.should.be.a('object');
        res.body.result.should.have.property('code').eql('user_registered');
        res.body.result.should.have.property('message').eql(user.username);
        done();
      });
  });

  it('Should register new user when both credientials are longer than the minimum length', (done) => {
    const user = {
      username: 'testuser',
      password: 'testpassword123',
    };

    chai.request(app)
      .post('/api/auth/register')
      .send(user)
      .end((err, res) => {
        res.should.have.status(200);
        res.body.should.be.a('object');
        res.body.should.have.property('result');
        res.body.result.should.be.a('object');
        res.body.result.should.have.property('code').eql('user_registered');
        res.body.result.should.have.property('message').eql(user.username);
        done();
      });
  });
});

// Login tests
describe('Login', () => {
  it('Shouldnt login with empty password', (done) => {
    const user = {
      username: 'testuser',
      password: '',
    };

    chai.request(app)
      .post('/api/auth/login')
      .send(user)
      .end((err, res) => {
        res.should.have.status(422);
        res.body.should.be.a('object');
        res.body.should.have.property('errors');
        res.body.errors.should.be.a('array');
        expect(res.body.errors.map((e: ResponseItem) => e.code)).to.include('password_incorrect');
        done();
      });
  });

  it('Shouldnt login with empty username', (done) => {
    const user = {
      username: '',
      password: 'testpassword123',
    };

    chai.request(app)
      .post('/api/auth/login')
      .send(user)
      .end((err, res) => {
        res.should.have.status(422);
        res.body.should.be.a('object');
        res.body.should.have.property('errors');
        res.body.errors.should.be.a('array');
        expect(res.body.errors.map((e: ResponseItem) => e.code)).to.include('user_not_found');
        done();
      });
  });

  it('Shouldnt login with empty credientials', (done) => {
    const user = {
      username: '',
      password: '',
    };

    chai.request(app)
      .post('/api/auth/login')
      .send(user)
      .end((err, res) => {
        res.should.have.status(422);
        res.body.should.be.a('object');
        res.body.should.have.property('errors');
        res.body.errors.should.be.a('array');
        expect(res.body.errors.map((e: ResponseItem) => e.code)).to.include('user_not_found');
        done();
      });
  });

  it('Shouldnt login with user that doesnt exist', (done) => {
    const user = {
      username: 'this_user_doesnt_exist',
      password: 'testpassword123',
    };

    chai.request(app)
      .post('/api/auth/login')
      .send(user)
      .end((err, res) => {
        res.should.have.status(422);
        res.body.should.be.a('object');
        res.body.should.have.property('errors');
        res.body.errors.should.be.a('array');
        expect(res.body.errors.map((e: ResponseItem) => e.code)).to.include('user_not_found');
        done();
      });
  });

  it('Should return token when user is successfully logged in', (done) => {
    const user = {
      username: 'testuser',
      password: 'testpassword123',
    };

    chai.request(app)
      .post('/api/auth/login')
      .send(user)
      .end((err, res) => {
        res.should.have.status(200);
        res.body.should.be.a('object');
        res.body.should.have.property('token');
        done();
      });
  });
});
