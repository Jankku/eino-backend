import chai from 'chai';
import chaiHttp from 'chai-http';
import app from '../src/app';

chai.should();
chai.use(chaiHttp);

describe('Movielist', () => {
  describe('Insert movies', () => {
    it('Should insert movie to completed list', (done) => {
      const movie = {
        title: 'Test movie',
        studio: 'Test studio',
        director: 'Director',
        writer: 'Writer',
        duration: 120,
        year: 2000,
        status: 'completed',
        start_date: '2021-07-20',
        end_date: '2021-07-20',
        score: 10,
      };

      chai.request(app)
        .post('/api/list/movies/add')
        .set('Authorization', `Bearer ${process.env.JWT_TEST_ACCESS_TOKEN}`)
        .send(movie)
        .end((err, res) => {
          res.should.have.status(201);
          res.body.should.be.a('object');
          res.body.should.have.property('results');
          res.body.results.should.be.a('array');
          res.body.results[0].should.have.property('name').eql('movie_added_to_list');
          res.body.results[0].should.have.property('message').eql('Movie added to list');
          done();
        });
    });

    it('Should insert movie to watching list', (done) => {
      const movie = {
        title: 'Test movie',
        studio: 'Test studio',
        director: 'Director',
        writer: 'Writer',
        duration: 120,
        year: 2000,
        status: 'watching',
        start_date: '2021-07-20',
        end_date: '2021-07-20',
        score: 0,
      };

      chai.request(app)
        .post('/api/list/movies/add')
        .set('Authorization', `Bearer ${process.env.JWT_TEST_ACCESS_TOKEN}`)
        .send(movie)
        .end((err, res) => {
          res.should.have.status(201);
          res.body.should.be.a('object');
          res.body.should.have.property('results');
          res.body.results.should.be.a('array');
          res.body.results[0].should.have.property('name').eql('movie_added_to_list');
          res.body.results[0].should.have.property('message').eql('Movie added to list');
          done();
        });
    });

    it('Should insert movie to on-hold list', (done) => {
      const movie = {
        title: 'Test movie',
        studio: 'Test studio',
        director: 'Director',
        writer: 'Writer',
        duration: 120,
        year: 2000,
        status: 'on-hold',
        start_date: '2021-07-20',
        end_date: '2021-07-20',
        score: 0,
      };

      chai.request(app)
        .post('/api/list/movies/add')
        .set('Authorization', `Bearer ${process.env.JWT_TEST_ACCESS_TOKEN}`)
        .send(movie)
        .end((err, res) => {
          res.should.have.status(201);
          res.body.should.be.a('object');
          res.body.should.have.property('results');
          res.body.results.should.be.a('array');
          res.body.results[0].should.have.property('name').eql('movie_added_to_list');
          res.body.results[0].should.have.property('message').eql('Movie added to list');
          done();
        });
    });

    it('Should insert movie to dropped list', (done) => {
      const movie = {
        title: 'Test movie',
        studio: 'Test studio',
        director: 'Director',
        writer: 'Writer',
        duration: 120,
        year: 2000,
        status: 'dropped',
        start_date: '2021-07-20',
        end_date: '2021-07-20',
        score: 1,
      };

      chai.request(app)
        .post('/api/list/movies/add')
        .set('Authorization', `Bearer ${process.env.JWT_TEST_ACCESS_TOKEN}`)
        .send(movie)
        .end((err, res) => {
          res.should.have.status(201);
          res.body.should.be.a('object');
          res.body.should.have.property('results');
          res.body.results.should.be.a('array');
          res.body.results[0].should.have.property('name').eql('movie_added_to_list');
          res.body.results[0].should.have.property('message').eql('Movie added to list');
          done();
        });
    });

    it('Should insert movie to planned list', (done) => {
      const movie = {
        title: 'Test movie',
        studio: 'Test studio',
        director: 'Director',
        writer: 'Writer',
        duration: 120,
        year: 2000,
        status: 'planned',
        start_date: '2021-07-20',
        end_date: '2021-07-20',
        score: 0,
      };

      chai.request(app)
        .post('/api/list/movies/add')
        .set('Authorization', `Bearer ${process.env.JWT_TEST_ACCESS_TOKEN}`)
        .send(movie)
        .end((err, res) => {
          res.should.have.status(201);
          res.body.should.be.a('object');
          res.body.should.have.property('results');
          res.body.results.should.be.a('array');
          res.body.results[0].should.have.property('name').eql('movie_added_to_list');
          res.body.results[0].should.have.property('message').eql('Movie added to list');
          done();
        });
    });
  });

  describe('Return lists with different status', () => {
    it('Should return completed list', (done) => {
      chai.request(app)
        .get('/api/list/movies/completed')
        .set('Authorization', `Bearer ${process.env.JWT_TEST_ACCESS_TOKEN}`)
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.should.have.property('results');
          res.body.results.should.be.a('array');
          res.body.results[0].should.be.a('object');
          res.body.results[0].should.have.property('movie_id');
          res.body.results[0].should.have.property('title');
          res.body.results[0].should.have.property('studio');
          res.body.results[0].should.have.property('director');
          res.body.results[0].should.have.property('writer');
          res.body.results[0].should.have.property('duration');
          res.body.results[0].should.have.property('year');
          res.body.results[0].should.have.property('status');
          res.body.results[0].should.have.property('score');
          res.body.results[0].should.have.property('start_date');
          res.body.results[0].should.have.property('end_date');
          res.body.results[0].should.have.property('created_on');
          done();
        });
    });

    it('Should return watching list', (done) => {
      chai.request(app)
        .get('/api/list/movies/watching')
        .set('Authorization', `Bearer ${process.env.JWT_TEST_ACCESS_TOKEN}`)
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.should.have.property('results');
          res.body.results.should.be.a('array');
          res.body.results[0].should.be.a('object');
          res.body.results[0].should.have.property('movie_id');
          res.body.results[0].should.have.property('title');
          res.body.results[0].should.have.property('studio');
          res.body.results[0].should.have.property('director');
          res.body.results[0].should.have.property('writer');
          res.body.results[0].should.have.property('duration');
          res.body.results[0].should.have.property('year');
          res.body.results[0].should.have.property('status');
          res.body.results[0].should.have.property('score');
          res.body.results[0].should.have.property('start_date');
          res.body.results[0].should.have.property('end_date');
          res.body.results[0].should.have.property('created_on');
          done();
        });
    });

    it('Should return on-hold list', (done) => {
      chai.request(app)
        .get('/api/list/movies/on-hold')
        .set('Authorization', `Bearer ${process.env.JWT_TEST_ACCESS_TOKEN}`)
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.should.have.property('results');
          res.body.results.should.be.a('array');
          res.body.results[0].should.be.a('object');
          res.body.results[0].should.have.property('movie_id');
          res.body.results[0].should.have.property('title');
          res.body.results[0].should.have.property('studio');
          res.body.results[0].should.have.property('director');
          res.body.results[0].should.have.property('writer');
          res.body.results[0].should.have.property('duration');
          res.body.results[0].should.have.property('year');
          res.body.results[0].should.have.property('status');
          res.body.results[0].should.have.property('score');
          res.body.results[0].should.have.property('start_date');
          res.body.results[0].should.have.property('end_date');
          res.body.results[0].should.have.property('created_on');
          done();
        });
    });

    it('Should return dropped list', (done) => {
      chai.request(app)
        .get('/api/list/movies/dropped')
        .set('Authorization', `Bearer ${process.env.JWT_TEST_ACCESS_TOKEN}`)
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.should.have.property('results');
          res.body.results.should.be.a('array');
          res.body.results[0].should.be.a('object');
          res.body.results[0].should.have.property('movie_id');
          res.body.results[0].should.have.property('title');
          res.body.results[0].should.have.property('studio');
          res.body.results[0].should.have.property('director');
          res.body.results[0].should.have.property('writer');
          res.body.results[0].should.have.property('duration');
          res.body.results[0].should.have.property('year');
          res.body.results[0].should.have.property('status');
          res.body.results[0].should.have.property('score');
          res.body.results[0].should.have.property('start_date');
          res.body.results[0].should.have.property('end_date');
          res.body.results[0].should.have.property('created_on');
          done();
        });
    });

    it('Should return planned list', (done) => {
      chai.request(app)
        .get('/api/list/movies/planned')
        .set('Authorization', `Bearer ${process.env.JWT_TEST_ACCESS_TOKEN}`)
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.should.have.property('results');
          res.body.results.should.be.a('array');
          res.body.results[0].should.be.a('object');
          res.body.results[0].should.have.property('movie_id');
          res.body.results[0].should.have.property('title');
          res.body.results[0].should.have.property('studio');
          res.body.results[0].should.have.property('director');
          res.body.results[0].should.have.property('writer');
          res.body.results[0].should.have.property('duration');
          res.body.results[0].should.have.property('year');
          res.body.results[0].should.have.property('status');
          res.body.results[0].should.have.property('score');
          res.body.results[0].should.have.property('start_date');
          res.body.results[0].should.have.property('end_date');
          res.body.results[0].should.have.property('created_on');
          done();
        });
    });
  });
});
