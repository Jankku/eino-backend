import chai, { use, should } from 'chai';
import chaiHttp from 'chai-http';
import app from '../src/app';
import { deleteAllUsers } from '../src/db/users';

should();
use(chaiHttp);

describe('Authentication', () => {
  describe('Register', () => {
    beforeEach(() => {
      deleteAllUsers();
    });

    it('Should error with empty password', (done) => {
      const user = {
        username: 'testuser1',
        password: '',
        password2: '',
      };

      chai
        .request(app)
        .post('/api/auth/register')
        .send(user)
        .end((error, res) => {
          res.should.have.status(422);
          res.body.should.be.a('object');
          res.body.should.have.property('errors');
          res.body.errors.should.be.a('array');
          res.body.errors[0].should.have.property('name').eql('password_length_invalid');
          done();
        });
    });

    it('Should error with too short password', (done) => {
      const user = {
        username: 'testuser2',
        password: 'test',
        password2: 'test',
      };

      chai
        .request(app)
        .post('/api/auth/register')
        .send(user)
        .end((error, res) => {
          res.should.have.status(422);
          res.body.should.be.a('object');
          res.body.should.have.property('errors');
          res.body.errors.should.be.a('array');
          res.body.errors[0].should.have.property('name').eql('password_length_invalid');
          done();
        });
    });

    it('Should error with too long password', (done) => {
      const user = {
        username: 'testuser3',
        password:
          'hnyf7RrvPBYUqgLp4KCcVG9TRgdCgGubTzShukasduu3i47237riuiuiug3r25CQj9enJMqdtVgHDjfDq8e4eL9n2UvQTKKLgtp2t5Tjbkth7pFQ7dBKqY6m99BLePn8Y799zzhFLBdRL9a7PJSpUqCRV3W5FGgkvnmsbwsVEQjvca6XRfPbPD3QEWnjV6y2As9aYccqXMbewSfJ4ALYzx7heCEmJ6CyGFgqyTnKnWMJs3rtksxsYbkUXxPckGA8tzFhGZgsre9vuct62uCR9cwS8ajshjasjd2312312',
        password2:
          'hnyf7RrvPBYUqgLp4KCcVG9TRgdCgGubTzShukasduu3i47237riuiuiug3r25CQj9enJMqdtVgHDjfDq8e4eL9n2UvQTKKLgtp2t5Tjbkth7pFQ7dBKqY6m99BLePn8Y799zzhFLBdRL9a7PJSpUqCRV3W5FGgkvnmsbwsVEQjvca6XRfPbPD3QEWnjV6y2As9aYccqXMbewSfJ4ALYzx7heCEmJ6CyGFgqyTnKnWMJs3rtksxsYbkUXxPckGA8tzFhGZgsre9vuct62uCR9cwS8ajshjasjd2312312',
      };

      chai
        .request(app)
        .post('/api/auth/register')
        .send(user)
        .end((error, res) => {
          res.should.have.status(422);
          res.body.should.be.a('object');
          res.body.should.have.property('errors');
          res.body.errors.should.be.a('array');
          res.body.errors[0].should.have.property('name').eql('password_length_invalid');
          done();
        });
    });

    it('Should error with empty username', (done) => {
      const user = {
        username: '',
        password: 'testpassword123',
        password2: 'testpassword123',
      };

      chai
        .request(app)
        .post('/api/auth/register')
        .send(user)
        .end((error, res) => {
          res.should.have.status(422);
          res.body.should.be.a('object');
          res.body.should.have.property('errors');
          res.body.errors.should.be.a('array');
          res.body.errors[0].should.have.property('name').eql('username_length_invalid');
          done();
        });
    });

    it('Should error with too short username', (done) => {
      const user = {
        username: 'te',
        password: 'testpassword123',
        password2: 'testpassword123',
      };

      chai
        .request(app)
        .post('/api/auth/register')
        .send(user)
        .end((error, res) => {
          res.should.have.status(422);
          res.body.should.be.a('object');
          res.body.should.have.property('errors');
          res.body.errors.should.be.a('array');
          res.body.errors[0].should.have.property('name').eql('username_length_invalid');
          done();
        });
    });

    it('Should error with too long username', (done) => {
      const user = {
        username:
          'hnyf7RrvPBYUqgLp4KCcVG9TRgdCgGubTzShukasduu3i47237riuiuiug3r25CQj9enJMqdtVgHDjfDq8e4eL9n2UvQTKKLgtp2t5Tjbkth7pFQ7dBKqY6m99BLePn8Y799zzhFLBdRL9a7PJSpUqCRV3W5FGgkvnmsbwsVEQjvca6XRfPbPD3QEWnjV6y2As9aYccqXMbewSfJ4ALYzx7heCEmJ6CyGFgqyTnKnWMJs3rtksxsYbkUXxPckGA8tzFhGZgsre9vuct62uCR9cwS8ajshjasjd2312312',
        password: 'testpassword123',
        password2: 'testpassword123',
      };

      chai
        .request(app)
        .post('/api/auth/register')
        .send(user)
        .end((error, res) => {
          res.should.have.status(422);
          res.body.should.be.a('object');
          res.body.should.have.property('errors');
          res.body.errors.should.be.a('array');
          res.body.errors[0].should.have.property('name').eql('username_length_invalid');
          done();
        });
    });

    it('Should register with minimum length username', (done) => {
      const user = {
        username: 'tes',
        password: 'testpassword123',
        password2: 'testpassword123',
      };

      chai
        .request(app)
        .post('/api/auth/register')
        .send(user)
        .end((error, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.should.have.property('results');
          res.body.results.should.be.a('array');
          res.body.results[0].should.have.property('name').eql('user_registered');
          res.body.results[0].should.have.property('message').eql(user.username);
          done();
        });
    });

    it('Should register with minimum length password', (done) => {
      const user = {
        username: 'someusername',
        password: 'testuser',
        password2: 'testuser',
      };

      chai
        .request(app)
        .post('/api/auth/register')
        .send(user)
        .end((error, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.should.have.property('results');
          res.body.results.should.be.a('array');
          res.body.results[0].should.have.property('name').eql('user_registered');
          res.body.results[0].should.have.property('message').eql(user.username);
          done();
        });
    });

    it('Should register with valid credientials', (done) => {
      const user = {
        username: 'testuser',
        password: 'testpassword123',
        password2: 'testpassword123',
      };

      chai
        .request(app)
        .post('/api/auth/register')
        .send(user)
        .end((error, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.should.have.property('results');
          res.body.results.should.be.a('array');
          res.body.results[0].should.have.property('name').eql('user_registered');
          res.body.results[0].should.have.property('message').eql(user.username);
          done();
        });
    });
  });

  describe('Login', () => {
    it('Should error with empty username', (done) => {
      const user = {
        username: '',
        password: 'testpassword123',
      };

      chai
        .request(app)
        .post('/api/auth/login')
        .send(user)
        .end((error, res) => {
          res.should.have.status(422);
          res.body.should.be.a('object');
          res.body.should.have.property('errors');
          res.body.errors.should.be.a('array');
          res.body.errors[0].should.have.property('name').eql('authentication_error');
          res.body.errors[0].should.have.property('message').eql('User not found');
          done();
        });
    });

    it('Should error with empty password', (done) => {
      const user = {
        username: 'testuser',
        password: '',
      };

      chai
        .request(app)
        .post('/api/auth/login')
        .send(user)
        .end((error, res) => {
          res.should.have.status(422);
          res.body.should.be.a('object');
          res.body.should.have.property('errors');
          res.body.errors.should.be.a('array');
          res.body.errors[0].should.have.property('name').eql('authentication_error');
          res.body.errors[0].should.have.property('message').eql('Incorrect password');
          done();
        });
    });

    it('Should error with empty credientials', (done) => {
      const user = {
        username: '',
        password: '',
      };

      chai
        .request(app)
        .post('/api/auth/login')
        .send(user)
        .end((error, res) => {
          res.should.have.status(422);
          res.body.should.be.a('object');
          res.body.should.have.property('errors');
          res.body.errors.should.be.a('array');
          res.body.errors[0].should.have.property('name').eql('authentication_error');
          res.body.errors[0].should.have.property('message').eql('User not found');
          done();
        });
    });

    it('Should error with nonexistent username', (done) => {
      const user = {
        username: 'this_user_doesnt_exist',
        password: 'testpassword123',
      };

      chai
        .request(app)
        .post('/api/auth/login')
        .send(user)
        .end((error, res) => {
          res.should.have.status(422);
          res.body.should.be.a('object');
          res.body.should.have.property('errors');
          res.body.errors.should.be.a('array');
          res.body.errors[0].should.have.property('name').eql('authentication_error');
          res.body.errors[0].should.have.property('message').eql('User not found');
          done();
        });
    });

    it('Should return tokens when user is successfully logged in', (done) => {
      const user = {
        username: 'testuser',
        password: 'testpassword123',
      };

      chai
        .request(app)
        .post('/api/auth/login')
        .send(user)
        .end((error, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.should.have.property('accessToken');
          res.body.accessToken.should.be.a('string');
          res.body.should.have.property('refreshToken');
          res.body.refreshToken.should.be.a('string');
          done();
        });
    });
  });

  describe('Refresh token', () => {
    it('Should error when using empty token', (done) => {
      const body = {
        refreshToken: '',
      };

      chai
        .request(app)
        .post('/api/auth/refreshtoken')
        .send(body)
        .end((error, res) => {
          res.should.have.status(400);
          res.body.should.be.a('object');
          res.body.should.have.property('errors');
          res.body.errors.should.be.a('array');
          res.body.errors[0].should.have.property('name').eql('invalid_request_body');
          res.body.errors[0].should.have
            .property('message')
            .eql('Send your refresh token on JSON body with key refreshToken');
          done();
        });
    });

    it('Should error when using invalid token', (done) => {
      const body = {
        refreshToken: 'asd.asd.asd',
      };

      chai
        .request(app)
        .post('/api/auth/refreshtoken')
        .send(body)
        .end((error, res) => {
          res.should.have.status(422);
          res.body.should.be.a('object');
          res.body.should.have.property('errors');
          res.body.errors.should.be.a('array');
          res.body.errors[0].should.have.property('name').eql('jwt_refresh_error');
          res.body.errors[0].should.have.property('message').eql('invalid token');
          done();
        });
    });

    it('Should return new access token', (done) => {
      const body = {
        refreshToken: `${process.env.JWT_TEST_REFRESH_TOKEN}`,
      };

      chai
        .request(app)
        .post('/api/auth/refreshtoken')
        .send(body)
        .end((error, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.should.have.property('accessToken');
          res.body.accessToken.should.be.a('string');
          done();
        });
    });
  });
});
