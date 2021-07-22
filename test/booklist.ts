/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable import/no-extraneous-dependencies */
import chai from 'chai';
import chaiHttp from 'chai-http';
import app from '../src/app';

chai.should();
chai.use(chaiHttp);

describe('Booklist', () => {
  describe('Insert books', () => {
    it('Should insert book to completed list', (done) => {
      const book = {
        isbn: '1827481928572',
        title: 'Test book',
        author: 'Test Author',
        publisher: 'Publisher',
        pages: 1234,
        year: 2000,
        status: 'completed',
        score: 10,
      };

      chai.request(app)
        .post('/api/list/books/add')
        .set('Authorization', `Bearer ${process.env.JWT_TEST_TOKEN}`)
        .send(book)
        .end((err, res) => {
          res.should.have.status(201);
          res.body.should.be.a('object');
          res.body.should.have.property('results');
          res.body.results.should.be.a('object');
          res.body.results.should.have.property('name').eql('book_added_to_list');
          res.body.results.should.have.property('message').eql('Book added to list');
          done();
        });
    });

    it('Should insert book to reading list', (done) => {
      const book = {
        isbn: '1827481928572',
        title: 'Test book',
        author: 'Test Author',
        publisher: 'Publisher',
        pages: 1234,
        year: 2000,
        status: 'reading',
        score: 0,
      };

      chai.request(app)
        .post('/api/list/books/add')
        .set('Authorization', `Bearer ${process.env.JWT_TEST_TOKEN}`)
        .send(book)
        .end((err, res) => {
          res.should.have.status(201);
          res.body.should.be.a('object');
          res.body.should.have.property('results');
          res.body.results.should.be.a('object');
          res.body.results.should.have.property('name').eql('book_added_to_list');
          res.body.results.should.have.property('message').eql('Book added to list');
          done();
        });
    });

    it('Should insert book to on-hold list', (done) => {
      const book = {
        isbn: '1827481928572',
        title: 'Test book',
        author: 'Test Author',
        publisher: 'Publisher',
        pages: 1234,
        year: 2000,
        status: 'on-hold',
        score: 0,
      };

      chai.request(app)
        .post('/api/list/books/add')
        .set('Authorization', `Bearer ${process.env.JWT_TEST_TOKEN}`)
        .send(book)
        .end((err, res) => {
          res.should.have.status(201);
          res.body.should.be.a('object');
          res.body.should.have.property('results');
          res.body.results.should.be.a('object');
          res.body.results.should.have.property('name').eql('book_added_to_list');
          res.body.results.should.have.property('message').eql('Book added to list');
          done();
        });
    });

    it('Should insert book to dropped list', (done) => {
      const book = {
        isbn: '1827481928572',
        title: 'Test book',
        author: 'Test Author',
        publisher: 'Publisher',
        pages: 1234,
        year: 2000,
        status: 'dropped',
        score: 0,
      };

      chai.request(app)
        .post('/api/list/books/add')
        .set('Authorization', `Bearer ${process.env.JWT_TEST_TOKEN}`)
        .send(book)
        .end((err, res) => {
          res.should.have.status(201);
          res.body.should.be.a('object');
          res.body.should.have.property('results');
          res.body.results.should.be.a('object');
          res.body.results.should.have.property('name').eql('book_added_to_list');
          res.body.results.should.have.property('message').eql('Book added to list');
          done();
        });
    });

    it('Should insert book to planned list', (done) => {
      const book = {
        isbn: '1827481928572',
        title: 'Test book',
        author: 'Test Author',
        publisher: 'Publisher',
        pages: 1234,
        year: 2000,
        status: 'planned',
        score: 0,
      };

      chai.request(app)
        .post('/api/list/books/add')
        .set('Authorization', `Bearer ${process.env.JWT_TEST_TOKEN}`)
        .send(book)
        .end((err, res) => {
          res.should.have.status(201);
          res.body.should.be.a('object');
          res.body.should.have.property('results');
          res.body.results.should.be.a('object');
          res.body.results.should.have.property('name').eql('book_added_to_list');
          res.body.results.should.have.property('message').eql('Book added to list');
          done();
        });
    });
  });

  describe('Return lists with different status', () => {
    it('Should return completed list', (done) => {
      chai.request(app)
        .get('/api/list/books/completed')
        .set('Authorization', `Bearer ${process.env.JWT_TEST_TOKEN}`)
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.should.have.property('results');
          res.body.results.should.be.a('array');
          res.body.results[0].should.be.a('object');
          res.body.results[0].should.have.property('book_id');
          res.body.results[0].should.have.property('status');
          res.body.results[0].should.have.property('score');
          res.body.results[0].should.have.property('created_on');
          done();
        });
    });

    it('Should return reading list', (done) => {
      chai.request(app)
        .get('/api/list/books/reading')
        .set('Authorization', `Bearer ${process.env.JWT_TEST_TOKEN}`)
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.should.have.property('results');
          res.body.results.should.be.a('array');
          res.body.results[0].should.be.a('object');
          res.body.results[0].should.have.property('book_id');
          res.body.results[0].should.have.property('status');
          res.body.results[0].should.have.property('score');
          res.body.results[0].should.have.property('created_on');
          done();
        });
    });

    it('Should return on-hold list', (done) => {
      chai.request(app)
        .get('/api/list/books/on-hold')
        .set('Authorization', `Bearer ${process.env.JWT_TEST_TOKEN}`)
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.should.have.property('results');
          res.body.results.should.be.a('array');
          res.body.results[0].should.be.a('object');
          res.body.results[0].should.have.property('book_id');
          res.body.results[0].should.have.property('status');
          res.body.results[0].should.have.property('score');
          res.body.results[0].should.have.property('created_on');
          done();
        });
    });

    it('Should return dropped list', (done) => {
      chai.request(app)
        .get('/api/list/books/dropped')
        .set('Authorization', `Bearer ${process.env.JWT_TEST_TOKEN}`)
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.should.have.property('results');
          res.body.results.should.be.a('array');
          res.body.results[0].should.be.a('object');
          res.body.results[0].should.have.property('book_id');
          res.body.results[0].should.have.property('status');
          res.body.results[0].should.have.property('score');
          res.body.results[0].should.have.property('created_on');
          done();
        });
    });

    it('Should return planned list', (done) => {
      chai.request(app)
        .get('/api/list/books/planned')
        .set('Authorization', `Bearer ${process.env.JWT_TEST_TOKEN}`)
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.should.have.property('results');
          res.body.results.should.be.a('array');
          res.body.results[0].should.be.a('object');
          res.body.results[0].should.have.property('book_id');
          res.body.results[0].should.have.property('status');
          res.body.results[0].should.have.property('score');
          res.body.results[0].should.have.property('created_on');
          done();
        });
    });
  });
});
